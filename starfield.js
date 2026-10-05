// Interactive Cosmic Dust and Nebula Particle Canvas
export class Starfield {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.smokePuffs = [];
    this.numParticles = 90;
    this.numPuffs = 15;
    this.width = 0;
    this.height = 0;
    this.accentColor = { r: 16, g: 185, b: 129 }; // default mint/emerald

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.init();
    this.animate();
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  setAccentColor(r, g, b) {
    this.accentColor = { r, g, b };
  }

  init() {
    this.particles = [];
    for (let i = 0; i < this.numParticles; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 1.8 + 0.5,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        alpha: Math.random() * 0.7 + 0.2,
        pulseSpeed: Math.random() * 0.02 + 0.005
      });
    }

    this.smokePuffs = [];
    for (let i = 0; i < this.numPuffs; i++) {
      this.smokePuffs.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 180 + 120,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        alpha: Math.random() * 0.04 + 0.015
      });
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Render soft glowing nebula clouds
    for (let puff of this.smokePuffs) {
      puff.x += puff.vx;
      puff.y += puff.vy;

      if (puff.x < -puff.radius) puff.x = this.width + puff.radius;
      if (puff.x > this.width + puff.radius) puff.x = -puff.radius;
      if (puff.y < -puff.radius) puff.y = this.height + puff.radius;
      if (puff.y > this.height + puff.radius) puff.y = -puff.radius;

      const grad = this.ctx.createRadialGradient(
        puff.x, puff.y, 0,
        puff.x, puff.y, puff.radius
      );
      const { r, g, b } = this.accentColor;
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${puff.alpha})`);
      grad.addColorStop(0.5, `rgba(${r * 0.6}, ${g * 0.3}, ${b * 0.8}, ${puff.alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(10, 15, 29, 0)');

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Render stars/dust
    for (let p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      p.alpha += Math.sin(Date.now() * p.pulseSpeed) * 0.005;
      const safeAlpha = Math.max(0.1, Math.min(0.9, p.alpha));

      this.ctx.fillStyle = `rgba(255, 255, 255, ${safeAlpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    requestAnimationFrame(() => this.animate());
  }
}
