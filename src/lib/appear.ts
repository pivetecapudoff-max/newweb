export function bindAppear(root: ParentNode = document): () => void {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(".appear, .hero-photo"));
  let cancelled = false;

  const onEnd = (event: AnimationEvent) => {
    (event.currentTarget as HTMLElement).classList.add("is-in");
  };

  nodes.forEach((el) => {
    el.addEventListener("animationend", onEnd, { once: true });
  });

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if (cancelled) return;
      nodes.forEach((el) => {
        const anims = typeof el.getAnimations === "function" ? el.getAnimations() : [];
        const alive = anims.some(
          (anim) => anim.playState === "running" || anim.playState === "finished",
        );
        if (!alive) el.classList.add("is-in");
      });
    });
  });

  return () => {
    cancelled = true;
    nodes.forEach((el) => el.removeEventListener("animationend", onEnd));
  };
}
