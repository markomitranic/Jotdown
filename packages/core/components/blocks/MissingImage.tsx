/**
 * The stand-in for a picture that is not there, drawn where it should be with a line saying why.
 *
 * A page pasted from another site keeps its pictures only when the browser
 * may download them, and one it may not is written as `![alt]()`. An address
 * that answers with no picture is the other way to get here. Either way the
 * gap is seen and filled rather than drawn as a broken icon.
 *
 * Given `onPick`, as an editor gives it, the whole placeholder is a button
 * asking for a picture to fill it, one dropped on it or one chosen.
 *
 * @example <MissingImage alt="Company logo" reason="downloaded" />
 * @example <MissingImage alt="" reason="downloaded" onPick={choose} />
 */
export default function MissingImage({
  alt,
  reason,
  onPick,
}: {
  alt: string;
  reason: "downloaded" | "loaded";
  onPick?: () => void;
}) {
  if (onPick) {
    return (
      <button type="button" className="jd-missing jd-missing--pick jd-shot" contentEditable={false} onClick={onPick}>
        <MissingArt />
        <span className="jd-shot-caption">
          {alt
            ? `${alt}: drop a picture here, or click to choose one.`
            : "Drop a picture here, or click to choose one."}
        </span>
      </button>
    );
  }

  return (
    <span className="jd-missing jd-shot" role="img" aria-label={alt || `An image that could not be ${reason}`}>
      <MissingArt />
      <span className="jd-shot-caption">
        {alt ? `Could not be ${reason}: ${alt}` : `This image could not be ${reason}.`}
      </span>
    </span>
  );
}

/** A torn picture frame, drawn in the figure palette so it follows the colour mode. */
function MissingArt() {
  return (
    <svg className="jd-missing-art" viewBox="0 0 240 160" aria-hidden="true">
      <path
        d="M20 32 Q20 20 32 20 L150 20 L164 34 L155 45 L172 57 L162 69 L182 80 L172 93 L196 101 L220 108 L220 128 Q220 140 208 140 L32 140 Q20 140 20 128 Z"
        fill="var(--jd-fig-surface)"
        stroke="var(--jd-fig-line)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeLinejoin="round"
      />
      <circle cx="58" cy="48" r="9" fill="var(--jd-fig-accent-soft)" stroke="var(--jd-fig-accent)" strokeWidth="1.5" />
      <polygon points="40,120 85,65 130,120" fill="var(--jd-fig-muted)" opacity="0.5" />
      <polygon points="95,120 140,75 185,120" fill="var(--jd-fig-accent-soft)" />
      <polygon points="190,40 198,35 197,46" fill="var(--jd-fig-line-soft)" />
      <polygon points="204,60 214,57 211,68" fill="var(--jd-fig-line-soft)" opacity="0.8" />
    </svg>
  );
}
