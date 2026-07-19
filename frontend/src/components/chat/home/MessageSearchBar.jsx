import styles from '../../../pages/ChatHome.module.css';

/** Local encrypted message search within the open thread. */
export default function MessageSearchBar({ query, onQueryChange, hits, onSelectHit }) {
  return (
    <div className={styles.searchBar}>
      <input
        placeholder="Search messages (local, encrypted index)"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
      />
      {hits.length > 0 && (
        <ul className={styles.searchHits}>
          {hits.map((hit) => (
            <li key={hit.id}>
              <button type="button" onClick={() => onSelectHit(hit.id)}>
                {hit.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
