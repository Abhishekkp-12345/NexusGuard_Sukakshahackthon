import { useEffect, useRef } from "react";

export default function ParticleBackground({ isDarkMode }: { isDarkMode: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const mouse = { x: -1000, y: -1000, radius: 200 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", handleResize);

    interface Particle {
      x: number; y: number; vx: number; vy: number;
      radius: number; color: string; glowRGB: string;
      pulsePhase: number; pulseSpeed: number;
    }

    // ------- THEME-DEPENDENT CONFIG -------
    const particleCount = isDarkMode ? 65 : 55;

    // Dark Mode: Sapphire / Electric / Gold palette
    const darkColors = [
      { fill: "#3B82F6", glow: "59,130,246" },    // blue-500
      { fill: "#6366F1", glow: "99,102,241" },    // indigo-500
      { fill: "#F59E0B", glow: "245,158,11" },    // amber-500
      { fill: "#14B8A6", glow: "20,184,166" },    // teal-500
    ];

    // Light Mode: Soft professional blues and violets - VISIBLE but elegant
    const lightColors = [
      { fill: "#60A5FA", glow: "96,165,250" },    // blue-400
      { fill: "#818CF8", glow: "129,140,248" },   // indigo-400
      { fill: "#93C5FD", glow: "147,197,253" },   // blue-300
      { fill: "#A78BFA", glow: "167,139,250" },   // violet-400
      { fill: "#67E8F9", glow: "103,232,249" },   // cyan-300
    ];

    const colors = isDarkMode ? darkColors : lightColors;
    const particles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      const c = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (isDarkMode ? 0.45 : 0.35),
        vy: (Math.random() - 0.5) * (isDarkMode ? 0.45 : 0.35),
        radius: Math.random() * (isDarkMode ? 2.2 : 2.0) + 1.0,
        color: c.fill,
        glowRGB: c.glow,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.006 + Math.random() * 0.014,
      });
    }

    // Connection line settings
    const maxDistance = isDarkMode ? 160 : 140;
    const maxLinkAlpha = isDarkMode ? 0.16 : 0.12;
    const nodeAlpha = isDarkMode ? 0.85 : 0.45;
    const linkRGB = isDarkMode ? "59,130,246" : "96,165,250";

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Light mode: draw a very subtle gradient wash behind the network
      if (!isDarkMode) {
        const gradient = ctx.createRadialGradient(
          width * 0.3, height * 0.4, 0,
          width * 0.3, height * 0.4, width * 0.55
        );
        gradient.addColorStop(0, "rgba(219,234,254,0.25)");  // blue-100
        gradient.addColorStop(0.6, "rgba(238,242,255,0.12)"); // indigo-50
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // second subtle gradient on opposite corner
        const g2 = ctx.createRadialGradient(
          width * 0.75, height * 0.7, 0,
          width * 0.75, height * 0.7, width * 0.4
        );
        g2.addColorStop(0, "rgba(199,210,254,0.15)");  // indigo-200
        g2.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, width, height);
      }

      // Draw links between particles
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];

        // Mouse-to-particle connections
        if (mouse.x > 0) {
          const dx = p1.x - mouse.x;
          const dy = p1.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const alpha = (1 - dist / mouse.radius) * maxLinkAlpha * 2;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(${linkRGB}, ${alpha})`;
            ctx.lineWidth = isDarkMode ? 0.9 : 0.7;
            ctx.stroke();

            // Gentle repulsion
            const force = (mouse.radius - dist) / mouse.radius;
            p1.x += (dx / dist) * force * 0.4;
            p1.y += (dy / dist) * force * 0.4;
          }
        }

        // Particle-to-particle links
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * maxLinkAlpha;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${linkRGB}, ${alpha})`;
            ctx.lineWidth = isDarkMode ? 0.7 : 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        p.x = Math.max(0, Math.min(width, p.x));
        p.y = Math.max(0, Math.min(height, p.y));

        p.pulsePhase += p.pulseSpeed;
        const pulse = 0.75 + 0.25 * Math.sin(p.pulsePhase);
        const r = p.radius * pulse;

        // Glow halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + (isDarkMode ? 4 : 5), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.glowRGB}, ${isDarkMode ? 0.06 : 0.08})`;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = nodeAlpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
    };
  }, [isDarkMode]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
