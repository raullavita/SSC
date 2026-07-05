import styles from './LinkPreviewCard.module.css';

export default function LinkPreviewCard({ preview }) {
  if (!preview?.url) return null;

  const { url, hostname, title, description, image, limited } = preview;

  return (
    <a
      className={styles.card}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={limited ? 'Limited preview — site blocks client fetch' : undefined}
    >
      {image && !limited && (
        <img className={styles.image} src={image} alt="" loading="lazy" />
      )}
      <div className={styles.body}>
        <span className={styles.hostname}>{hostname}</span>
        <span className={styles.title}>{title}</span>
        {description && !limited && (
          <span className={styles.description}>{description}</span>
        )}
      </div>
    </a>
  );
}