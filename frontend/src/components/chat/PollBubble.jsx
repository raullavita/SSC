import styles from './PollBubble.module.css';

export default function PollBubble({
  poll,
  tallies = {},
  viewerVote = null,
  disabled = false,
  onVote,
}) {
  if (!poll?.question) return null;

  return (
    <div className={styles.poll}>
      <p className={styles.question}>{poll.question}</p>
      <div className={styles.options}>
        {poll.options.map((label, index) => {
          const count = tallies[String(index)] || 0;
          const selected = viewerVote === index;
          return (
            <button
              key={`${poll.id || poll.question}-${index}`}
              type="button"
              className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
              disabled={disabled || viewerVote !== null}
              onClick={() => onVote?.(index)}
            >
              <span>{label}</span>
              <span className={styles.count}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}