import React, { useEffect, useRef, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

/** 语言映射：统一到 Prism 支持的语言名 */
const languageMap: Record<string, string> = {
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  python: 'python',
  py: 'python',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  css: 'css',
  sql: 'sql',
  java: 'java',
  go: 'go',
  rust: 'rust',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  csharp: 'csharp',
  'c#': 'csharp',
  php: 'php',
  ruby: 'ruby',
  swift: 'swift',
  kotlin: 'kotlin',
  scala: 'scala',
  dart: 'dart',
  r: 'r',
  markdown: 'markdown',
  md: 'markdown',
};

/** 深色代码块：右上角语言标签 + 复制按钮 + 语法高亮。 */
export const DocCodeBlock: React.FC<DocCodeBlockProps> = ({ code, language = 'bash', maxHeight = 420 }) => {
  const { copied, copy } = useCopyState(code);
  const mappedLanguage = languageMap[language.toLowerCase()] || language;

  return (
    <div className="lc-code">
      <SyntaxHighlighter
        language={mappedLanguage}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '14px 84px 14px 16px',
          borderRadius: '4px',
          fontSize: '12.5px',
          lineHeight: '1.6',
          maxHeight,
          overflow: 'auto',
        }}
        wrapLines={true}
        wrapLongLines={true}
      >
        {code}
      </SyntaxHighlighter>
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

/** 带行号、JSON 高亮与复制按钮的预览块。 */
export const DocJsonBlock: React.FC<DocJsonBlockProps> = ({ data, label = 'json', maxHeight = 360 }) => {
  const jsonStr = JSON.stringify(data, null, 2);
  const { copied, copy } = useCopyState(jsonStr);

  return (
    <div className="lc-code">
      <SyntaxHighlighter
        language="json"
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '14px 84px 14px 16px',
          borderRadius: '4px',
          fontSize: '12.5px',
          lineHeight: '1.6',
          maxHeight,
          overflow: 'auto',
        }}
        wrapLines={true}
        wrapLongLines={true}
        showLineNumbers={true}
        lineNumberStyle={{
          color: '#858585',
          minWidth: '26px',
          marginRight: '12px',
          userSelect: 'none',
          textAlign: 'right',
        }}
      >
        {jsonStr}
      </SyntaxHighlighter>
      <div className="lc-code-actions">
        <button type="button" className={`lc-code-btn${copied ? ' copied' : ''}`} onClick={copy}>
          {copied ? '已复制' : '复制'}
        </button>
        <span className="lc-code-lang">{label}</span>
      </div>
    </div>
  );
};
