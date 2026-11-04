import React, { useEffect, useRef, useState } from 'react';

const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 继续尝试 execCommand 兜底
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

/** 复制状态 + 自动复位。非安全上下文（http 内网地址）使用 execCommand 兜底。 */
const useCopyState = (text: string) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const copy = async () => {
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return { copied, copy };
};

interface DocCodeBlockProps {
  code: string;
  language?: string;
  maxHeight?: number;
}

/** 深色代码块：右上角语言标签 + 复制按钮。 */
export const DocCodeBlock: React.FC<DocCodeBlockProps> = ({ code, language = 'bash', maxHeight = 420 }) => {
  const { copied, copy } = useCopyState(code);

  return (
    <div className="lc-code">
      <pre style={{ maxHeight }}>
        <code>{code}</code>
      </pre>
      <div className="lc-code-actions">
        <button type="button" className={`lc-code-btn${copied ? ' copied' : ''}`} onClick={copy}>
          {copied ? '已复制' : '复制'}
        </button>
        <span className="lc-code-lang">{language}</span>
      </div>
    </div>
  );
};

interface DocJsonBlockProps {
  data: unknown;
  label?: string;
  maxHeight?: number;
}

const highlightJsonLine = (line: string): string =>
  line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"([^"]+)":/g, '<span style="color:#9cdcfe">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span style="color:#ce9178">"$1"</span>')
    .replace(/: (\d+)/g, ': <span style="color:#b5cea8">$1</span>')
    .replace(/: (true|false|null)/g, ': <span style="color:#569cd6">$1</span>');

/** 带行号、JSON 高亮与复制按钮的预览块。 */
export const DocJsonBlock: React.FC<DocJsonBlockProps> = ({ data, label = 'json', maxHeight = 360 }) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const { copied, copy } = useCopyState(jsonStr);

  return (
    <div className="lc-code">
      <pre style={{ maxHeight }}>
        <code>
          {jsonStr.split('\n').map((line, index) => (
            <div key={index} className="lc-json-line">
              <span className="lc-json-lineno">{index + 1}</span>
              <span dangerouslySetInnerHTML={{ __html: highlightJsonLine(line) }} />
            </div>
          ))}
        </code>
      </pre>
      <div className="lc-code-actions">
        <button type="button" className={`lc-code-btn${copied ? ' copied' : ''}`} onClick={copy}>
          {copied ? '已复制' : '复制'}
        </button>
        <span className="lc-code-lang">{label}</span>
      </div>
    </div>
  );
};
