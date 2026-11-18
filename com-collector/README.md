# COM 采集器（leetcode.com 在线人数）

采集 leetcode.com 各题在线人数，写入线上 Redis（经 SSH 隧道 16390），
再由 Go 后端落库。

## 为什么必须用真实浏览器

任何"轻量"方案都被 Cloudflare 拦掉了。2026-11-18 实测：

| 方式 | 结果 |
|---|---|
| 裸 WebSocket 握手（Origin/Referer/UA 齐全） | 403 `cf-mitigated: challenge` |
| curl_cffi 模拟 Chrome / Safari TLS 指纹 | 403 |
| 拿浏览器真 cookie 去握手 WS | 403 |
| 手工实现 h2 RFC 8441 WS CONNECT | 400 |
| 浏览器自己握手 | **101，正常收到数字帧** |
| 同一 Chromium 改 `headless: true` | **全 403（0/8）** |

最后一行是决定性的：同一个浏览器只把无头打开就全挂，说明 CF 判的不只是
UA/TLS，还有有头渲染环境暴露的信号。

**不需要境外 IP，甚至更差**（同机同浏览器只换出口）：

- 北京家宽：4/10 拿到帧
- 美国机房（机场 hysteria2 落地）：0/10，页面直接被挑战

条件是「信誉尚可的住宅/家宽 IP + 有头浏览器」，与地理位置无关。这也解释了
为什么采集器跑在用户本机、而不是 `leetcode-001`（西安机房 IP，会被全拦）。

## 可靠性设计

历史教训：2026-11-13 断流埋了一周没人发现，因为所有监控都只查"进程活着吗"。
**进程存活 != 数据在流动**。

### 1. 数据新鲜度判据（`health-check.sh`）

只认一个指标：Redis 里 COM 数据的最大 `last_updated` 与当前时间的差。

```
./health-check.sh
# OK age=1m keys=100 ...
# STALE age=42m threshold=15m keys=100 ...   （退出码 1）
# UNKNOWN redis tunnel 16390 unreachable      （退出码 2，不误报断流）
```

隧道不通时判 UNKNOWN 而不是 STALE，避免把网络问题误当成采集故障。

### 2. 自愈（`watchdog.sh`，由 systemd timer 每分钟触发）

按顺序检查并修复：

1. **wayland socket**：判据是「socket 文件存在 **且** 被活着的 weston 持有」
   （查 `/proc/<pid>/fd`）。只看文件存在不够——进程死后 socket 会以 stale
   inode 残留，看起来正常但实际不可用。weston 本身由 systemd 托管，watchdog
   只在 unit 卡住时踢醒它。
2. **SSH 隧道 16390**：不通则重建 autossh/ssh。
3. **采集器进程**：不在则拉起；拉起前先清孤儿 Chromium（常驻模式被强杀后，
   Chromium 会挂到 systemd 下不退出，堆积几轮会吃穿内存）。
4. **数据新鲜度**：陈旧则整条链路重建（先停旧进程再起新的）。
   刚启动 5 分钟内不判陈旧（`STARTUP_GRACE`），否则会误杀正在预热的进程。

### 3. systemd 托管

三个用户单元（源文件在 `systemd/`，`bash systemd/install.sh` 安装）：

**`wayland-headless.service`** —— 显示环境的基础
- `Restart=always`，`RestartSec=2`：weston 死了 2 秒后自动拉起
- **`ExecStopPost` 强制删除 `/run/user/1000/wayland-99{,.lock}`**
  systemd 不清理 unix socket 文件，残留的 stale inode 会让新 weston 因
  名字被占而起不来 —— 这就是 2026-11-13 断流的根因，也是混沌测试
  `total_wipe` 抓到的那个 FAIL。这一行是根治点，**不要删**
- 开机自启（`WantedBy=default.target`）

**`com-collector-watchdog.{service,timer}`** —— 每分钟巡检并自愈
- `Persistent=true`，关机错过的调度在开机后补跑
- `KillMode=mixed`：默认的 `control-group` 会在 oneshot 结束时把 watchdog
  拉起的 collector 一并杀掉；`none` 已被 systemd 标记废弃
- 用户已设 `Linger=yes`，登出后服务仍存活

### 4. 日志轮转

`watchdog.sh` 开头把 `/tmp/com-collector-local.log`、`/tmp/weston.log`
超过 20MB 的截到 5MB。/tmp 写满会连带挤掉 weston 的 socket，等于自己制造断流。

## 采集器内部策略（`collector.js`）

- **浏览器整轮常驻**：一轮只 launch 一次 Chromium，仅在上下文真死时重建
  （`isConnected()` + 开页面探测双重判据）
- **预热**：每次新建上下文先访问首页拿 CF 的 cookie（实测 403 显著减少）
- **轮末补采**：本轮失败的题在周期末尾再跑一遍。CF 挑战是概率性的，
  同一题隔一会儿往往就过（实测某题首轮 3 次全 403，补采 2 次就拿到）
- **重试退避**：失败后间隔 2s/4s/5s 递增再试，背靠背连打会持续触发挑战

## 混沌测试（验证自愈真的兜得住）

`chaos-test.sh` 注入故障后**完全不干预**，只等 systemd timer 自己救活。
恢复判据严格：要求数据时间戳晚于注入时刻（不是只看 health OK）。

```bash
./chaos-test.sh collector_dead   # 只杀采集器
./chaos-test.sh socket_gone      # weston 保留但删掉 socket（11-13 故障形态）
./chaos-test.sh frozen           # SIGSTOP 冻结，进程活着但数据停流
./chaos-test.sh total_wipe       # 全杀：采集器+weston+chromium+隧道（等效重启）
```

2026-11-18 实测结果：

| 场景 | 结果 |
|---|---|
| collector_dead | PASS，145s 恢复 |
| frozen | PASS，判定 STALE 后自动重建 |
| total_wipe（修复前） | **FAIL —— 10+ 分钟 0/100 且 health 一直报 OK** |
| total_wipe（修复后） | PASS，4 分钟内恢复 |

`total_wipe` 那次 FAIL 抓到一个真实漏洞：weston 被 kill -9 后 socket 文件
以 stale inode 残留，`[ -S ]` 判据误判"正常"，新 weston 起不来 —— 正是
11-13 的故障形态。修法是判据改为「socket 存在 **且** 被活着的 weston 持有」。

## 运维

```bash
# 健康状态
./health-check.sh

# 手动跑一次看门狗
./watchdog.sh

# 看门狗日志（含 health 心跳与自愈记录）
tail -f /tmp/com-collector-watchdog.log

# systemd
systemctl --user status com-collector-watchdog.timer
systemctl --user list-timers com-collector-watchdog.timer
```

关键文件：

- PID 文件 `/tmp/com-collector-local.pid`
- 启动时刻 `/tmp/com-collector-started-at`（宽限期用）
- 采集日志 `/tmp/com-collector-local.log`

### 单实例保护

`start-com-collector-local.sh` 有两层保护，避免重复拉起导致两套浏览器互相干扰：

1. PID 文件在且进程活着 -> 直接退出
2. PID 文件丢失或进程换过 cwd -> 按工作目录兜底识别

外面再套 `flock`，兜住定时器与手动执行撞在同一秒的情况。

### 故障排查速查

| 现象 | 先查什么 |
|---|---|
| 数据不更新（`STALE`） | `tail /tmp/com-collector-local.log` 看是否大量 `403` |
| `UNKNOWN` | 隧道：`redis-cli -p 16390 ping`；断了就 `./watchdog.sh` |
| 采集器反复重启 | `grep "grace" /tmp/com-collector-watchdog.log`，确认是否宽限期太短 |
| 内存持续上涨 | `pgrep -f ms-playwright/chromium`，清理孤儿浏览器 |
| 浏览器起不来 | `ls -l /run/user/1000/wayland-99`，socket 不在就 `./watchdog.sh` |

### 已知限制

- CF 的挑战是**概率性**的，单轮不可能 100% 覆盖；靠轮末补采与下一轮追平，
  长期看覆盖率会稳定在高位，但不会恒等于 100%。
- 采集器依赖本机家宽 IP 的信誉。**换到机房/云服务器 IP 会被 CF 全拦**
  （实测 0/10），所以它不能搬到线上服务器。
- 换了网络环境（比如换了宽带、开了 VPN）后先去 `./health-check.sh` 看是否
  还在 `OK`，必要时用 `COM_DISABLE_IPV6=false` 回退 IPv4 禁用策略。
