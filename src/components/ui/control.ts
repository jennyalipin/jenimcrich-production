/**
 * Shared chrome for Input / Select / Textarea: 8px radius, slate-300 border,
 * and the system's signature focus — emerald border + 3px emerald-100 halo.
 * Invalid state flips the same treatment to red via aria-invalid.
 */
export const controlClass =
  "w-full rounded-control border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-400 focus:border-primary focus:ring-[3px] focus:ring-primary-soft disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:ring-danger-soft";
