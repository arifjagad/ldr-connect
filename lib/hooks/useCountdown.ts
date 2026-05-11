import { useEffect, useRef, useState } from "react";

export function useCountdown(
  targetISO: string | null,
  onExpire: () => void
): number | null {
  const [seconds, setSeconds] = useState<number | null>(null);
  const calledRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  // Keep ref current without adding to effect deps
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!targetISO) return;
    calledRef.current = false;

    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(targetISO).getTime() - Date.now()) / 1000));
      setSeconds(diff);
      if (diff === 0 && !calledRef.current) {
        calledRef.current = true;
        onExpireRef.current();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetISO]); // onExpire excluded — always reads latest via ref

  return seconds;
}
