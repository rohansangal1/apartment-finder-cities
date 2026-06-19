import { useUserData } from '../context/UserDataContext';

/** Heart toggle to save/unsave a listing (guest: localStorage; signed in: per-user DB). */
export default function SaveButton({ id, className = '' }: { id: string; className?: string }) {
  const { isSaved, toggleSaved } = useUserData();
  const saved = isSaved(id);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggleSaved(id);
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save apartment'}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-slate-100 ${className}`}
    >
      <svg
        className={`h-5 w-5 ${saved ? 'text-rose-500' : 'text-slate-300'}`}
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 21s-7.5-4.6-10-9.2C.5 8.5 2 5 5.5 5 7.6 5 9 6.2 12 9c3-2.8 4.4-4 6.5-4C22 5 23.5 8.5 22 11.8 19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
  );
}
