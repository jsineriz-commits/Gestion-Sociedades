export function formatRelativeTime(dateInput: string | Date | null | undefined): string {
    if (!dateInput) return 'S/D';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'S/D';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    // Formato de fecha base (ej. "31/10/2026")
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const baseDateStr = `${d}/${m}/${y}`;

    let relativeStr = '';
    
    if (diffSecs < 60) {
        relativeStr = 'ahora';
    } else if (diffMins < 60) {
        relativeStr = `${diffMins} min`;
    } else if (diffHours < 24) {
        relativeStr = `${diffHours}h`;
    } else if (diffDays < 30) {
        relativeStr = `${diffDays}d`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        relativeStr = `${months}m`;
    } else {
        const years = Math.floor(diffDays / 365);
        relativeStr = `${years}a`;
    }

    if (relativeStr === 'ahora') return `${baseDateStr} (ahora)`;
    return `${baseDateStr} (${relativeStr})`;
}
