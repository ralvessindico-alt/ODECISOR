/** Componentes visuais compartilhados. Padrão iOS: listas agrupadas, ação fixa no rodapé. */

export const Group = ({ header, footer, children, style }) => (
  <div style={{ marginBottom: 26, ...style }}>
    {header && (
      <div
        style={{
          fontSize: 13,
          color: "var(--label3)",
          textTransform: "uppercase",
          padding: "0 16px 7px",
        }}
      >
        {header}
      </div>
    )}
    <div style={{ background: "var(--card)", borderRadius: 12, overflow: "hidden" }}>
      {children}
    </div>
    {footer && (
      <div
        style={{ fontSize: 13, color: "var(--label3)", lineHeight: 1.4, padding: "7px 16px 0" }}
      >
        {footer}
      </div>
    )}
  </div>
);

export const Row = ({ children, onClick, last, style }) => (
  <div
    onClick={onClick}
    style={{
      padding: "13px 16px",
      borderBottom: last ? "none" : "0.5px solid var(--sep)",
      cursor: onClick ? "pointer" : "default",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Pill = ({ children, onClick, disabled, variant = "primary" }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: "100%",
      padding: "15px 20px",
      fontSize: 17,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      color: variant === "plain" ? "var(--blue)" : "#fff",
      background: disabled
        ? "#C7C7CC"
        : variant === "plain"
        ? "var(--card)"
        : variant === "danger"
        ? "var(--red)"
        : "var(--blue)",
      border: "none",
      borderRadius: 14,
      cursor: disabled ? "default" : "pointer",
    }}
  >
    {children}
  </button>
);

export const Campo = ({ value, onChange, placeholder, rows = 6, tipo }) =>
  tipo ? (
    <input
      type={tipo}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoCapitalize="none"
      style={{
        width: "100%",
        fontSize: 17,
        border: "none",
        outline: "none",
        padding: 0,
        background: "transparent",
      }}
    />
  ) : (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: "100%",
        padding: "14px 16px",
        fontSize: 17,
        lineHeight: 1.45,
        border: "none",
        background: "var(--card)",
        resize: "none",
        outline: "none",
        letterSpacing: "-0.01em",
      }}
    />
  );

export const Badge = ({ children, cor }) => (
  <span
    style={{
      fontSize: 12,
      fontWeight: 600,
      color: cor,
      background: `${cor}1A`,
      padding: "3px 9px",
      borderRadius: 20,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </span>
);

export const Metrica = ({ rotulo, valor, cor }) => (
  <div style={{ background: "var(--card)", borderRadius: 12, padding: "14px 12px" }}>
    <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", color: cor, lineHeight: 1.1 }}>
      {valor}
    </div>
    <div style={{ fontSize: 13, color: "var(--label3)", marginTop: 2 }}>{rotulo}</div>
  </div>
);

export const Titulo = ({ children, sub }) => (
  <>
    <h1
      style={{
        fontSize: 34,
        fontWeight: 700,
        letterSpacing: "-0.035em",
        margin: sub ? "0 0 8px" : "0 0 22px",
        padding: "0 4px",
      }}
    >
      {children}
    </h1>
    {sub && (
      <p
        style={{
          fontSize: 16,
          lineHeight: 1.45,
          color: "var(--label3)",
          margin: "0 0 22px",
          padding: "0 4px",
        }}
      >
        {sub}
      </p>
    )}
  </>
);

export const Aviso = ({ children, tipo = "erro", onClick }) => {
  const cores = { erro: "var(--red)", ok: "var(--green)", alerta: "var(--orange)" };
  return (
    <div
      onClick={onClick}
      style={{
        background: `color-mix(in srgb, ${cores[tipo]} 8%, transparent)`,
        color: tipo === "erro" ? "var(--red)" : "var(--label)",
        padding: "12px 16px",
        borderRadius: 12,
        fontSize: 15,
        lineHeight: 1.4,
        marginBottom: 20,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {children}
    </div>
  );
};

export const BarraAcao = ({ children }) => (
  <div
    style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "rgba(242,242,247,0.85)",
      backdropFilter: "saturate(180%) blur(20px)",
      WebkitBackdropFilter: "saturate(180%) blur(20px)",
      borderTop: "0.5px solid var(--sep)",
      padding: "12px 16px calc(22px + env(safe-area-inset-bottom))",
    }}
  >
    <div style={{ maxWidth: 640, margin: "0 auto" }}>{children}</div>
  </div>
);

export const QUADRANTES = {
  Q1: { t: "Urgente e importante", a: "Fazer agora", c: "var(--red)" },
  Q2: { t: "Importante, não urgente", a: "Agendar", c: "var(--orange)" },
  Q3: { t: "Urgente, não importante", a: "Delegar", c: "var(--blue)" },
  Q4: { t: "Nem urgente, nem importante", a: "Aguardar", c: "var(--label3)" },
};

export const ESTADOS = {
  resolvido: { t: "Resolvido", c: "var(--green)" },
  nao_resolvido: { t: "Não resolvido", c: "var(--red)" },
  aberto: { t: "Decisão aberta", c: "var(--blue)" },
  expirado: { t: "Expirado", c: "var(--label3)" },
  aguardando_resultado: { t: "No prazo", c: "var(--orange)" },
};

export const fmtData = (d) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export const horasRestantes = (deadline) =>
  Math.round((new Date(deadline).getTime() - Date.now()) / 36e5);
