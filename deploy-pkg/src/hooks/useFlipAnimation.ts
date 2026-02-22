import { useRef, useLayoutEffect, useCallback } from 'react';

interface Position {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface RowPositions {
  [key: string]: Position;
}

export function useFlipAnimation<T extends { id: number | string }>(
  data: T[],
  options: {
    duration?: number;
    easing?: string;
    selector?: string;
  } = {}
) {
  const { duration = 400, easing = 'cubic-bezier(0.25, 0.1, 0.25, 1)', selector = '[data-row-id]' } = options;
  
  const prevPositions = useRef<RowPositions>({});
  const tableRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // 记录当前所有行的位置
  const recordPositions = useCallback(() => {
    const positions: RowPositions = {};
    const rows = tableRef.current?.querySelectorAll(selector);
    
    rows?.forEach((row) => {
      const rowId = row.getAttribute('data-row-id');
      if (rowId) {
        const rect = row.getBoundingClientRect();
        positions[rowId] = {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      }
    });
    
    return positions;
  }, [selector]);

  // 在DOM更新前记录位置
  useLayoutEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    prevPositions.current = recordPositions();
  }, [data.map(d => d.id).join(','), recordPositions]);

  // 在DOM更新后计算并应用动画
  useLayoutEffect(() => {
    if (Object.keys(prevPositions.current).length === 0) return;

    const newPositions = recordPositions();
    const animatedRows: { element: Element; deltaY: number }[] = [];

    // 计算每个行的偏移量
    Object.keys(newPositions).forEach((rowId) => {
      const prevPos = prevPositions.current[rowId];
      const newPos = newPositions[rowId];

      if (prevPos && newPos) {
        const deltaY = prevPos.top - newPos.top;
        
        if (Math.abs(deltaY) > 1) { // 只有位置变化超过1px才动画
          const row = tableRef.current?.querySelector(`[data-row-id="${rowId}"]`);
          if (row) {
            animatedRows.push({ element: row, deltaY });
          }
        }
      }
    });

    // 应用invert transform
    animatedRows.forEach(({ element, deltaY }) => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.transition = 'none';
      htmlElement.style.transform = `translateY(${deltaY}px)`;
      htmlElement.style.willChange = 'transform';
    });

    // 强制回流
    tableRef.current?.offsetHeight;

    // 播放动画
    requestAnimationFrame(() => {
      animatedRows.forEach(({ element }) => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.transition = `transform ${duration}ms ${easing}`;
        htmlElement.style.transform = 'translateY(0)';
      });

      // 动画结束后清理
      setTimeout(() => {
        animatedRows.forEach(({ element }) => {
          const htmlElement = element as HTMLElement;
          htmlElement.style.transition = '';
          htmlElement.style.transform = '';
          htmlElement.style.willChange = '';
        });
      }, duration);
    });

    prevPositions.current = {};
  }, [data, duration, easing, recordPositions]);

  return { tableRef };
}

export default useFlipAnimation;
