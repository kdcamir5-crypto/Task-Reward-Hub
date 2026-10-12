
/* tasks.css - টাস্ক পেজের স্টাইল (ড্যাশবোর্ডের .app, .head, .nav ব্যবহার করে) */
.top{background:var(--forest);color:var(--on-forest);padding:16px 18px;display:flex;justify-content:space-between;align-items:center}
.tabs2{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:14px 16px}
.tabs2 button{border:1px solid var(--line);background:var(--card);border-radius:99px;padding:7px;cursor:pointer;font-weight:600;color:var(--muted)}
.tabs2 button[aria-pressed="true"]{background:var(--forest);color:var(--on-forest);border-color:var(--forest)}
.task{margin:10px 16px;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:14px}
.task__row{display:flex;justify-content:space-between;gap:10px}
.task h4{font-size:1rem}
.task p{color:var(--muted);font-size:.9rem;margin-top:2px}
.reward{font-weight:700;white-space:nowrap}
.pill{display:inline-block;font-size:.75rem;padding:2px 10px;border-radius:99px;margin-top:8px;background:var(--bg);border:1px solid var(--line)}
.pill--pending{color:#8A5A00}.pill--done{color:#1D7A46}.pill--rejected{color:var(--danger)}
.task form{margin-top:10px;display:grid;gap:8px}
.task input{padding:10px;border:1px solid var(--line);border-radius:10px;background:var(--bg)}
.task .go{border:0;background:var(--forest);color:var(--on-forest);padding:10px;border-radius:10px;font-weight:700;cursor:pointer}
.task .dev{border:1px dashed var(--muted);background:none;border-radius:8px;padding:6px;cursor:pointer;font-size:.8rem;margin-top:8px}
.note{margin:14px 16px;font-size:.85rem;color:var(--muted)}
