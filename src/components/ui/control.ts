/**
 * Shared chrome for Input / Select / Textarea: 6px radius, slate-300 border, a
 * subtle recessed inset, and the system's signature focus — emerald border +
 * 3px emerald halo. Invalid state flips the same treatment to red.
 */
export const controlClass =
  "w-full rounded-control border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-[var(--shadow-input-inset)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:ring-[3px] focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:ring-danger-soft";
