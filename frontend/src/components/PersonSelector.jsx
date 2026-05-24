export default function PersonSelector({ person, onChange }) {
  return (
    <div className="person-selector card">
      <span className="person-label">Who are you?</span>
      <div className="person-btns">
        <button
          className={`person-btn ${person === "Dad" ? "active dad" : ""}`}
          onClick={() => onChange("Dad")}
        >
          👨 Dad
        </button>
        <button
          className={`person-btn ${person === "Mom" ? "active mom" : ""}`}
          onClick={() => onChange("Mom")}
        >
          👩 Mom
        </button>
      </div>
    </div>
  );
}
