"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

export default function RedeemModal({ onClose, onSuccess }: Props) {
  const [code, setCode]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<{ credits: number; newBalance: number } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "兑换失败，请重试");
        return;
      }
      setSuccess(data);
      onSuccess(data.newBalance);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-2xl"
        style={{ background: "#1a1a1a", border: "1px solid #2e2e2e", padding: "32px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-base" style={{ color: "#f0f0f0" }}>兑换激活码</h2>
            <p className="text-xs mt-0.5" style={{ color: "#555" }}>输入格式：XUE-XXXXX-XXXXX</p>
          </div>
          <button
            onClick={onClose}
            className="text-lg leading-none transition-colors duration-150"
            style={{ color: "#555" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#aaa"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#555"; }}
          >
            ×
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-3">🎉</div>
            <p className="font-semibold mb-1" style={{ color: "#f0f0f0" }}>
              成功兑换 <span style={{ color: "#EEC170" }}>{success.credits} 积分</span>
            </p>
            <p className="text-sm" style={{ color: "#666" }}>
              当前余额：{success.newBalance} 积分
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200"
              style={{ background: "linear-gradient(135deg, #e8634a 0%, #cf4f38 100%)" }}
            >
              确定
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XUE-XXXXX-XXXXX"
              className="w-full px-4 py-3 rounded-xl outline-none font-mono text-sm tracking-wider mb-3"
              style={{
                background: "#111",
                border: `1px solid ${error ? "rgba(232,99,74,0.5)" : "#2e2e2e"}`,
                color: "#f0f0f0",
                caretColor: "#38BCD4",
              }}
              onFocus={(e) => { if (!error) (e.currentTarget as HTMLElement).style.borderColor = "#444"; }}
              onBlur={(e) => { if (!error) (e.currentTarget as HTMLElement).style.borderColor = "#2e2e2e"; }}
              autoFocus
            />

            {error && (
              <p className="text-xs mb-3" style={{ color: "#e85d4a" }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #e8634a 0%, #cf4f38 100%)" }}
            >
              {loading ? "兑换中…" : "立即兑换"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
