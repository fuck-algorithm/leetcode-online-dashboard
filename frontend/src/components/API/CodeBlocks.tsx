import React from 'react';

// 语法高亮代码块
export const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language = 'bash' }) => (
  <pre style={{ 
    background: '#1e1e1e', 
    color: '#d4d4d4',
    padding: 16, 
    borderRadius: 8, 
    fontFamily: 'Consolas, Monaco, "Courier New", monospace', 
    fontSize: 13,
    overflow: 'auto',
    maxHeight: 400,
    lineHeight: 1.6,
    margin: 0,
    position: 'relative'
  }}>
    <div style={{ 
      position: 'absolute', 
      top: 8, 
      right: 8, 
      color: '#6a9955', 
      fontSize: 11,
      background: '#2d2d2d',
      padding: '2px 8px',
      borderRadius: 4
    }}>{language}</div>
    <code>{code}</code>
  </pre>
);

// JSON 高亮
export const JsonBlock: React.FC<{ data: any }> = ({ data }) => {
  const jsonStr = JSON.stringify(data, null, 2);
  return (
    <pre style={{ 
      background: '#1e1e1e', 
      color: '#d4d4d4',
      padding: 16, 
      borderRadius: 8, 
      fontFamily: 'Consolas, Monaco, "Courier New", monospace', 
      fontSize: 13,
      overflow: 'auto',
      maxHeight: 400,
      lineHeight: 1.6,
      margin: 0,
      position: 'relative'
    }}>
      <div style={{ 
        position: 'absolute', 
        top: 8, 
        right: 8, 
        color: '#6a9955', 
        fontSize: 11,
        background: '#2d2d2d',
        padding: '2px 8px',
        borderRadius: 4
      }}>json</div>
      <code style={{ color: '#d4d4d4' }}>
        {jsonStr.split('\n').map((line, i) => (
          <div key={i} style={{ display: 'flex' }}>
            <span style={{ 
              color: '#858585', 
              minWidth: 30, 
              textAlign: 'right', 
              marginRight: 12,
              userSelect: 'none'
            }}>{i + 1}</span>
            <span style={{ color: '#d4d4d4' }} dangerouslySetInnerHTML={{
              __html: line
                .replace(/"([^"]+)":/g, '<span style="color:#9cdcfe">"$1"</span>:')
                .replace(/: "([^"]*)"/g, ': <span style="color:#ce9178">"$1"</span>')
                .replace(/: (\d+)/g, ': <span style="color:#b5cea8">$1</span>')
                .replace(/: (true|false|null)/g, ': <span style="color:#569cd6">$1</span>')
            }} />
          </div>
        ))}
      </code>
    </pre>
  );
};
