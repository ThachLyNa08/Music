<template>
  <div class="landing-page">
    <nav class="landing-nav">
      <RouterLink class="brand" to="/landing">MusicFlow AI</RouterLink>

      <div class="nav-links" aria-label="Landing navigation">
        <a href="#features">Features</a>
        <a href="#premium">Premium</a>
        <RouterLink to="/login">Login</RouterLink>
      </div>

      <RouterLink class="pill-btn pill-btn--small" to="/login">Get Started</RouterLink>
    </nav>

    <main class="landing-main">
      <section class="hero-section">
        <div class="hero-depth" aria-hidden="true">
          <div class="hero-disc hero-disc--back" />
          <div class="hero-disc hero-disc--front" />
          <div class="hero-bars">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <h1>MusicFlow - Nền tảng phát nhạc AI thế hệ mới</h1>
        <p>
          Experience music through the lens of artificial intelligence. Personalized,
          immersive, and limitless. Let the algorithm craft your perfect sonic journey.
        </p>

        <div class="hero-actions">
          <RouterLink class="pill-btn" to="/login">Get Started</RouterLink>
          <button class="pill-btn pill-btn--ghost" type="button" @click="scrollToDemo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch Demo
          </button>
        </div>
      </section>

      <section id="demo" class="demo-panel" aria-label="MusicFlow AI demo">
        <div class="wave-scene" aria-hidden="true">
          <div class="wave wave--one" />
          <div class="wave wave--two" />
          <div class="wave wave--three" />
          <div class="sound-stage">
            <div class="record-3d" />
            <div class="equalizer-3d">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div class="prism prism--one" />
            <div class="prism prism--two" />
          </div>
        </div>

        <button class="demo-play" type="button" aria-label="Play demo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>

        <div class="live-badge">
          <span />
          Live AI Generation
        </div>
      </section>

      <section id="features" class="feature-grid" aria-label="MusicFlow AI features">
        <article class="feature-card feature-card--large">
          <div class="card-glow" />
          <div class="feature-copy">
            <svg class="feature-icon feature-icon--green" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 15.5v-7h2v7H5Zm4 3v-13h2v13H9Zm4-5v-3h2v3h-2Zm4 3.5V7h2v10h-2Z" />
            </svg>
            <h2>Your Personal AI DJ</h2>
            <p>
              Our neural engine analyzes thousands of acoustic traits in real-time,
              learning your distinct taste to seamlessly mix tracks with perfect
              harmonic and rhythmic transitions.
            </p>
          </div>

          <div class="mini-player">
            <div class="album-art" aria-hidden="true" />
            <div class="track-meta">
              <strong>Midnight City Flow</strong>
              <span>AI DJ Transitioning...</span>
            </div>
            <svg class="waves-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2v2c-2 0-2-2-4-2s-2 2-4 2-2-2-4-2-2 2-4 2-2-2-4-2V8Zm0 6c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2v2c-2 0-2-2-4-2s-2 2-4 2-2-2-4-2-2 2-4 2-2-2-4-2v-2Z" />
            </svg>
            <div class="progress">
              <span />
            </div>
          </div>
        </article>

        <article class="feature-card feature-card--small">
          <div class="feature-copy">
            <svg class="feature-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
            </svg>
            <h2>Sing with AI Stems</h2>
            <p>
              Instantly isolate vocals, drums, or bass from any track with studio-grade
              precision for the ultimate karaoke experience.
            </p>
          </div>

          <div class="chip-row">
            <span>Vocals</span>
            <span class="chip--active">Instrumental</span>
          </div>
        </article>

        <article class="feature-card feature-card--medium">
          <div class="feature-copy">
            <svg class="feature-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 5h16v11H7.2L4 19.2V5Zm2 2v7.38L6.38 14H18V7H6Z" />
            </svg>
            <h2>Prompt Your Playlist</h2>
            <p>
              Describe a mood, a scenario, or a feeling, and let our LLM generate a
              curated hour of uninterrupted audio magic.
            </p>
          </div>

          <form class="prompt-form" @submit.prevent>
            <input aria-label="Playlist prompt" placeholder="e.g. 'Lofi for a rainy night coding session'" />
            <button type="submit">Generate</button>
          </form>
        </article>

        <article id="premium" class="feature-card feature-card--premium feature-card--medium">
          <div class="premium-overlay" />
          <div class="feature-copy">
            <div class="premium-label">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m12 2 2.6 5.55 6.05.73-4.46 4.16 1.17 5.98L12 15.42l-5.36 3 1.17-5.98-4.46-4.16 6.05-.73L12 2Z" />
              </svg>
              Premium Plus
            </div>
            <h2>Lossless Audio &amp; Priority AI</h2>
            <p>
              Experience uncompromising 24-bit/192kHz high-resolution audio streaming
              with dedicated server processing for instant AI responses.
            </p>
          </div>

          <div class="checkout-row">
            <span>Secure checkout via</span>
            <div>
              <b>VNPay</b>
              <b class="momo">MoMo</b>
            </div>
          </div>
        </article>
      </section>
    </main>

    <footer class="landing-footer">
      <div>
        <strong>MusicFlow AI</strong>
        <span>© 2024 MusicFlow AI. For the audiophiles.</span>
      </div>
      <div class="footer-links">
        <a href="#features">About</a>
        <a href="#premium">Privacy</a>
        <a href="#premium">Terms</a>
        <RouterLink to="/login">Support</RouterLink>
      </div>
    </footer>
  </div>
</template>

<script setup>
function scrollToDemo() {
  document.querySelector('#demo')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap');

* {
  box-sizing: border-box;
}

.landing-page {
  position: relative;
  min-height: 100vh;
  background: #0B0F19;
  color: #ffffff;
  font-family: 'Be Vietnam Pro', sans-serif;
  overflow-x: hidden;
}

.landing-page::before {
  position: fixed;
  inset: 70px 0 0;
  z-index: 0;
  background:
    radial-gradient(circle at 20% 20%, rgba(124, 58, 237, 0.1) 0%, transparent 40%),
    radial-gradient(circle at 80% 60%, rgba(59, 130, 246, 0.08) 0%, transparent 40%),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.015) 0 1px, transparent 1px 88px),
    repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.015) 0 1px, transparent 1px 88px);
  content: "";
  pointer-events: none;
}

.landing-page::after {
  position: fixed;
  inset: auto 0 0;
  z-index: 0;
  height: 42vh;
  background: linear-gradient(0deg, #0B0F19, transparent);
  content: "";
  pointer-events: none;
}

.landing-nav {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 70px;
  padding: 0 32px;
  background: rgba(11, 15, 25, 0.75);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
}

.brand {
  color: #ffffff;
  font-size: 20px;
  font-weight: 900;
  text-decoration: none;
  background: linear-gradient(135deg, #7C3AED, #3B82F6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 8px rgba(124, 58, 237, 0.3));
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 42px;
}

.nav-links a {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: color .2s ease, transform .2s ease;
}

.nav-links a:hover {
  color: #7C3AED;
  transform: translateY(-1px);
}

.pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 34px;
  border: 0;
  border-radius: 9999px;
  background: linear-gradient(135deg, #7C3AED, #3B82F6);
  color: #ffffff;
  box-shadow: 0 8px 25px rgba(124, 58, 237, 0.3);
  cursor: pointer;
  font: 800 14px/1 'Be Vietnam Pro', sans-serif;
  text-decoration: none;
  transition: transform .2s ease, box-shadow .2s ease;
}

.pill-btn:hover {
  box-shadow: 0 12px 30px rgba(124, 58, 237, 0.5);
  transform: translateY(-2px) scale(1.02);
}

.pill-btn--small {
  min-height: 38px;
  padding: 0 28px;
  font-size: 13px;
}

.pill-btn--ghost {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
  box-shadow: 0 5px 15px rgba(0,0,0,0.2);
  backdrop-filter: blur(12px);
}

.pill-btn--ghost:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.15);
}

.pill-btn svg,
.demo-play svg,
.feature-icon,
.waves-icon,
.premium-label svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.landing-main {
  position: relative;
  z-index: 1;
  width: min(100%, 1280px);
  margin: 0 auto;
  padding: 62px 24px 132px;
}

.hero-section {
  position: relative;
  display: grid;
  justify-items: center;
  text-align: center;
  margin-bottom: 62px;
}

.hero-depth {
  position: absolute;
  inset: -70px 0 -48px;
  z-index: 0;
  overflow: hidden;
  perspective: 900px;
  pointer-events: none;
}

.hero-depth::before {
  position: absolute;
  inset: 8% 16%;
  background:
    radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.05) 0%, transparent 60%),
    linear-gradient(140deg, rgba(124, 58, 237, 0.05), rgba(59, 130, 246, 0.03), rgba(6, 182, 212, 0.04));
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 42px;
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.4);
  content: "";
  transform: rotateX(60deg) rotateZ(-9deg) translateY(34px);
  transform-style: preserve-3d;
}

.hero-disc {
  position: absolute;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #0B0F19 0 13%, #7C3AED 14% 18%, #3B82F6 19% 24%, #1E1B4B 25% 34%, #EC4899 35% 36%, rgba(124, 58, 237, 0.2) 37% 100%);
  box-shadow:
    inset 0 0 0 2px rgba(255, 255, 255, 0.1),
    inset 0 0 40px rgba(255, 255, 255, 0.05),
    0 28px 64px rgba(0, 0, 0, 0.5);
  transform-style: preserve-3d;
}

.hero-disc::after {
  position: absolute;
  inset: 12%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: inherit;
  content: "";
}

.hero-disc--back {
  right: 9%;
  top: 5%;
  width: 180px;
  height: 180px;
  opacity: .5;
  transform: rotateX(62deg) rotateZ(-28deg);
}

.hero-disc--front {
  left: 10%;
  bottom: 8%;
  width: 140px;
  height: 140px;
  opacity: .4;
  transform: rotateX(58deg) rotateZ(18deg);
}

.hero-bars {
  position: absolute;
  right: 22%;
  bottom: 15%;
  display: flex;
  align-items: end;
  gap: 10px;
  height: 92px;
  transform: rotateX(58deg) rotateZ(-10deg);
  transform-style: preserve-3d;
}

.hero-bars span {
  display: block;
  width: 18px;
  border-radius: 7px 7px 3px 3px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.15), rgba(124, 58, 237, 0.6));
  box-shadow: 0 16px 32px rgba(124, 58, 237, 0.15);
}

.hero-bars span:nth-child(1) { height: 42px; }
.hero-bars span:nth-child(2) { height: 80px; }
.hero-bars span:nth-child(3) { height: 58px; }
.hero-bars span:nth-child(4) { height: 70px; }

.hero-section h1,
.hero-section p,
.hero-actions {
  position: relative;
  z-index: 1;
}

.hero-section h1 {
  width: min(850px, 100%);
  margin: 0 0 24px;
  color: #ffffff;
  font-size: clamp(40px, 5vw, 64px);
  font-weight: 900;
  line-height: 1.14;
  letter-spacing: -0.02em;
  text-wrap: balance;
  background: linear-gradient(to right, #ffffff 40%, rgba(255, 255, 255, 0.7));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-section p {
  width: min(760px, 100%);
  margin: 0 0 44px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 17px;
  line-height: 1.65;
}

.hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
}

.demo-panel {
  position: relative;
  display: grid;
  place-items: center;
  height: clamp(360px, 43vw, 500px);
  margin-bottom: 126px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 44px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.005)),
    rgba(17, 24, 39, 0.6);
  box-shadow: 
    0 28px 70px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  perspective: 1100px;
  transform-style: preserve-3d;
  backdrop-filter: blur(20px);
}

.wave-scene {
  position: absolute;
  inset: 0;
  opacity: .5;
  filter: saturate(1.4);
  perspective: 1000px;
  transform-style: preserve-3d;
}

.wave {
  position: absolute;
  width: 78%;
  height: 44%;
  left: 13%;
  top: 18%;
  border: 5px solid rgba(124, 58, 237, 0.3);
  border-left-color: transparent;
  border-bottom-color: transparent;
  border-radius: 52% 48% 50% 50% / 38% 42% 58% 62%;
  filter: blur(.5px) drop-shadow(0 0 16px rgba(124, 58, 237, 0.2));
  transform: rotate(-8deg);
}

.wave--two {
  top: 25%;
  left: 7%;
  width: 88%;
  height: 52%;
  border-width: 4px;
  opacity: .55;
  border-color: rgba(59, 130, 246, 0.3);
  transform: rotate(10deg);
}

.wave--three {
  top: 3%;
  left: 34%;
  width: 42%;
  height: 90%;
  border-width: 4px;
  opacity: .42;
  border-color: rgba(236, 72, 153, 0.3);
  transform: rotate(27deg);
}

.sound-stage {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
}

.record-3d {
  position: absolute;
  top: 13%;
  left: 50%;
  width: min(42vw, 420px);
  height: min(42vw, 420px);
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 50%, #ffffff 0 8%, #7C3AED 9% 13%, transparent 14%),
    repeating-radial-gradient(circle at center, rgba(255, 255, 255, 0.1) 0 2px, transparent 2px 18px),
    radial-gradient(circle at 42% 34%, rgba(255, 255, 255, 0.3), transparent 22%),
    linear-gradient(145deg, #1E1B4B, #0F172A 42%, #311042);
  box-shadow:
    inset 0 0 0 4px rgba(255, 255, 255, 0.08),
    inset 0 -36px 60px rgba(0, 0, 0, 0.5),
    0 54px 90px rgba(0, 0, 0, 0.6);
  transform: translateX(-50%) rotateX(66deg) rotateZ(-18deg) translateZ(-55px);
  transform-style: preserve-3d;
  animation: recordFloat 8s ease-in-out infinite;
}

.record-3d::before {
  position: absolute;
  inset: -10px;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(124, 58, 237, 0.05));
  content: "";
  transform: translateZ(-16px);
}

.equalizer-3d {
  position: absolute;
  right: 13%;
  bottom: 17%;
  display: flex;
  align-items: end;
  gap: 14px;
  height: 150px;
  transform: rotateX(62deg) rotateZ(-16deg) translateZ(20px);
  transform-style: preserve-3d;
}

.equalizer-3d span {
  display: block;
  width: 34px;
  border-radius: 10px 10px 4px 4px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), #3B82F6 48%, #7C3AED);
  box-shadow:
    inset -8px 0 16px rgba(255, 255, 255, 0.2),
    0 20px 32px rgba(124, 58, 237, 0.2);
  transform-style: preserve-3d;
  animation: equalizerPulse 1.7s ease-in-out infinite;
}

.equalizer-3d span:nth-child(1) { height: 66px; animation-delay: -.15s; }
.equalizer-3d span:nth-child(2) { height: 112px; animation-delay: -.45s; }
.equalizer-3d span:nth-child(3) { height: 86px; animation-delay: -.25s; }
.equalizer-3d span:nth-child(4) { height: 136px; animation-delay: -.7s; }
.equalizer-3d span:nth-child(5) { height: 74px; animation-delay: -.35s; }

.prism {
  position: absolute;
  width: 132px;
  height: 132px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(124, 58, 237, 0.1)),
    linear-gradient(225deg, rgba(59, 130, 246, 0.1), transparent);
  box-shadow:
    inset 0 0 28px rgba(255, 255, 255, 0.05),
    0 30px 50px rgba(0, 0, 0, 0.4);
  transform-style: preserve-3d;
}

.prism::after {
  position: absolute;
  inset: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 18px;
  content: "";
}

.prism--one {
  top: 11%;
  left: 16%;
  transform: rotateX(58deg) rotateZ(32deg) translateZ(22px);
  animation: prismFloat 7s ease-in-out infinite;
}

.prism--two {
  right: 16%;
  top: 14%;
  width: 92px;
  height: 92px;
  border-radius: 20px;
  transform: rotateX(62deg) rotateZ(-21deg) translateZ(16px);
  animation: prismFloat 8.5s ease-in-out infinite reverse;
}

.demo-play {
  position: relative;
  z-index: 3;
  display: grid;
  place-items: center;
  width: 98px;
  height: 98px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
  box-shadow: 0 0 38px rgba(124, 58, 237, 0.3);
  cursor: pointer;
  backdrop-filter: blur(12px);
  transition: transform .2s ease, box-shadow .2s ease, background .2s;
}

.demo-play:hover {
  box-shadow: 0 0 46px rgba(124, 58, 237, 0.5);
  transform: scale(1.06);
  background: rgba(255, 255, 255, 0.1);
}

.demo-play svg {
  width: 46px;
  height: 46px;
}

.live-badge {
  position: absolute;
  z-index: 3;
  top: calc(50% + 78px);
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 26px;
  padding: 0 16px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
  transform: translateX(-50%);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}

.live-badge span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #EC4899;
  box-shadow: 0 0 12px rgba(236, 72, 153, 0.8);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 18px;
  perspective: 1200px;
}

.feature-card {
  position: relative;
  display: flex;
  min-height: 290px;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  padding: 34px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 42px;
  background: rgba(255, 255, 255, 0.02);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(24px);
  transform-style: preserve-3d;
  transition: transform .28s ease, box-shadow .28s ease, border-color .28s ease, background-color .28s;
}

.feature-card:hover {
  border-color: rgba(124, 58, 237, 0.3);
  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 30px 68px rgba(124, 58, 237, 0.15);
  transform: translateY(-8px) rotateX(2deg) rotateY(-2deg);
}

.feature-card--large {
  grid-column: span 8;
  min-height: 350px;
}

.feature-card--small {
  grid-column: span 4;
  min-height: 350px;
}

.feature-card--medium {
  grid-column: span 6;
}

.card-glow {
  position: absolute;
  top: -90px;
  right: -80px;
  width: 270px;
  height: 270px;
  border-radius: 48px;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(59, 130, 246, 0.1));
  filter: blur(72px);
  transform: rotate(18deg);
}

.feature-copy {
  position: relative;
  z-index: 1;
  transform: translateZ(24px);
}

.feature-icon {
  display: block;
  margin-bottom: 22px;
  color: #7C3AED;
}

.feature-icon--green {
  color: #3B82F6;
}

.feature-card h2 {
  margin: 0 0 12px;
  color: #ffffff;
  font-size: 31px;
  font-weight: 900;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.feature-card--small h2 {
  font-size: 22px;
}

.feature-card p {
  width: min(610px, 100%);
  margin: 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  line-height: 1.65;
}

.mini-player {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 46px 1fr auto;
  gap: 14px;
  align-items: center;
  min-height: 70px;
  margin-top: 28px;
  padding: 12px 16px 18px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.02);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.3);
  transform: translateZ(36px);
}

.album-art {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background:
    radial-gradient(circle at 45% 45%, #7C3AED, transparent 36%),
    radial-gradient(circle at 30% 35%, rgba(59, 130, 246, .65), transparent 34%),
    linear-gradient(135deg, #1E1B4B, #3B82F6);
}

.track-meta {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.track-meta strong {
  overflow: hidden;
  color: #ffffff;
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-meta span {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waves-icon {
  color: #3B82F6;
}

.progress {
  position: absolute;
  right: 16px;
  bottom: 8px;
  left: 16px;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.progress span {
  display: block;
  width: 65%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #7C3AED, #3B82F6);
}

.chip-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 28px;
}

.chip-row span,
.checkout-row b {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 14px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 800;
}

.chip-row .chip--active {
  background: rgba(124, 58, 237, 0.15);
  border-color: rgba(124, 58, 237, 0.3);
  color: #ffffff;
}

.prompt-form {
  position: relative;
  margin-top: 30px;
}

.prompt-form input {
  width: 100%;
  height: 48px;
  padding: 0 112px 0 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  outline: none;
  background: rgba(255, 255, 255, 0.03);
  color: #ffffff;
  font: 500 13px/1 'Be Vietnam Pro', sans-serif;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  transition: all 0.3s;
}

.prompt-form input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.prompt-form input:focus {
  border-color: #7C3AED;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.25);
}

.prompt-form button {
  position: absolute;
  top: 5px;
  right: 5px;
  height: 38px;
  padding: 0 22px;
  border: 0;
  border-radius: 9999px;
  background: linear-gradient(135deg, #7C3AED, #3B82F6);
  color: #ffffff;
  cursor: pointer;
  font: 800 12px/1 'Be Vietnam Pro', sans-serif;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
}
.prompt-form button:hover { 
  transform: scale(1.05); 
  box-shadow: 0 6px 16px rgba(124, 58, 237, 0.4);
}

.feature-card--premium {
  background: rgba(255, 255, 255, 0.02);
}

.premium-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 40%, rgba(236, 72, 153, 0.05));
}

.premium-label {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
  color: #EC4899;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.premium-label svg {
  width: 26px;
  height: 26px;
}

.checkout-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-top: 30px;
  padding-top: 22px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.checkout-row > span {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.checkout-row > div {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.checkout-row .momo {
  color: #ff4aaa;
}

.landing-footer {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(160px, .45fr);
  gap: 60px;
  align-items: start;
  min-height: 200px;
  padding: 54px 32px;
  background: #0B0F19;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.landing-footer > div:first-child,
.footer-links {
  width: min(100%, 1280px);
}

.landing-footer strong {
  display: block;
  margin-bottom: 24px;
  color: #ffffff;
  font-size: 18px;
  font-weight: 900;
  background: linear-gradient(135deg, #7C3AED, #3B82F6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.landing-footer span,
.landing-footer a {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  text-decoration: none;
}

.footer-links {
  display: grid;
  gap: 14px;
}

.footer-links a:hover {
  color: #7C3AED;
}

@keyframes recordFloat {
  0%,
  100% {
    transform: translateX(-50%) rotateX(66deg) rotateZ(-18deg) translateZ(-55px) translateY(0);
  }
  50% {
    transform: translateX(-50%) rotateX(66deg) rotateZ(-10deg) translateZ(-40px) translateY(-10px);
  }
}

@keyframes equalizerPulse {
  0%,
  100% {
    transform: translateZ(0) scaleY(.82);
  }
  50% {
    transform: translateZ(24px) scaleY(1.08);
  }
}

@keyframes prismFloat {
  0%,
  100% {
    translate: 0 0;
  }
  50% {
    translate: 0 -14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: .01ms !important;
  }
}

@media (max-width: 900px) {
  .landing-nav {
    height: auto;
    min-height: 70px;
    gap: 16px;
    padding: 18px 20px;
    flex-wrap: wrap;
  }

  .brand {
    flex: 1;
  }

  .nav-links {
    order: 3;
    width: 100%;
    justify-content: center;
    gap: 24px;
  }

  .landing-main {
    padding-top: 44px;
  }

  .hero-section h1 {
    font-size: 40px;
  }

  .feature-card--large,
  .feature-card--small,
  .feature-card--medium {
    grid-column: span 12;
  }

  .demo-panel {
    margin-bottom: 72px;
    border-radius: 30px;
  }

  .record-3d {
    width: 360px;
    height: 360px;
  }

  .equalizer-3d {
    right: 7%;
    gap: 10px;
  }

  .equalizer-3d span {
    width: 26px;
  }

  .feature-grid {
    gap: 16px;
  }
}

@media (max-width: 560px) {
  .landing-main {
    padding-inline: 16px;
    padding-bottom: 80px;
  }

  .landing-nav {
    align-items: center;
  }

  .nav-links {
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 2px;
  }

  .pill-btn--small {
    padding: 0 20px;
  }

  .hero-section {
    margin-bottom: 44px;
  }

  .hero-section h1 {
    font-size: 32px;
  }

  .hero-section p {
    font-size: 15px;
  }

  .hero-actions {
    align-items: stretch;
    width: 100%;
  }

  .hero-actions .pill-btn {
    width: 100%;
  }

  .demo-panel {
    height: 360px;
  }

  .hero-depth {
    opacity: .52;
  }

  .hero-disc--back,
  .hero-disc--front {
    display: none;
  }

  .record-3d {
    left: 48%;
    top: 18%;
    width: 280px;
    height: 280px;
  }

  .equalizer-3d {
    right: 4%;
    bottom: 12%;
    height: 110px;
  }

  .equalizer-3d span {
    width: 18px;
  }

  .prism {
    width: 80px;
    height: 80px;
  }

  .feature-card {
    min-height: auto;
    padding: 26px;
    border-radius: 28px;
  }

  .feature-card h2 {
    font-size: 25px;
  }

  .feature-card--small h2 {
    font-size: 22px;
  }

  .mini-player {
    grid-template-columns: 42px 1fr;
  }

  .waves-icon {
    display: none;
  }

  .prompt-form input {
    height: auto;
    min-height: 50px;
    padding: 15px 18px 62px;
    border-radius: 24px;
  }

  .prompt-form button {
    top: auto;
    right: 6px;
    bottom: 6px;
    left: 6px;
  }

  .checkout-row,
  .landing-footer {
    grid-template-columns: 1fr;
  }

  .checkout-row {
    align-items: flex-start;
  }

  .checkout-row > div {
    justify-content: flex-start;
  }
}
</style>
