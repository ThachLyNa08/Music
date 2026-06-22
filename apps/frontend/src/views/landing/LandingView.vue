<template>
  <div ref="landingRef" class="musicflow-landing min-h-screen bg-[#090B14] text-[#B8C1D1] font-sans selection:bg-[#1ED760] selection:text-black overflow-x-hidden">
    <!-- Navbar -->
    <nav class="mf-navbar fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#090B14]/70 backdrop-blur-xl border-b border-white/5 transition-all">
      <div class="flex items-center gap-8">
        <RouterLink to="/landing" class="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <MfIcon name="music" size="24" class="text-[#1ED760]" />
          MusicFlow
        </RouterLink>
        <div class="hidden md:flex items-center gap-6 text-sm font-semibold text-[#8B93A7]">
          <a href="#features" class="hover:text-white transition-colors">Tính năng</a>
          <a href="#premium" class="hover:text-white transition-colors">Premium</a>
        </div>
      </div>
      <div class="flex items-center gap-5 text-sm font-semibold">
        <RouterLink to="/login" class="text-[#8B93A7] hover:text-white transition-colors hidden sm:block">Đăng nhập</RouterLink>
        <RouterLink to="/login" class="bg-white text-black px-6 py-2.5 rounded-full hover:scale-105 transition-transform font-bold shadow-lg">Bắt đầu miễn phí</RouterLink>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero-section relative w-full h-[100vh] min-h-[850px] flex items-center justify-center overflow-hidden bg-[#090B14]">
      <!-- Wave glow background layers (CSS only) -->
      <div class="wave-glow-container" aria-hidden="true">
        <div class="wave-glow-bg green"></div>
        <div class="wave-glow-bg blue"></div>
        <div class="wave-glow-bg green-2"></div>
      </div>

      <!-- Video Background -->
      <video
        autoplay muted loop playsinline
        class="absolute inset-0 w-full h-full object-cover z-0 opacity-80"
        :poster="apiMediaUrl('/uploads/playlist_cover/downloaded-file.gif')"
      >
        <source :src="apiMediaUrl('/uploads/playlist_cover/9d878016056576ec2059ecb2cbdc677b.mp4')" type="video/mp4" />
      </video>
      
      <!-- Overlay Layers -->
      <div class="absolute inset-0 bg-black/50 z-10"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-[#090B14] via-[#090B14]/40 to-transparent z-10"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-[#090B14]/90 via-[#090B14]/50 to-transparent z-10"></div>
      
      <!-- Content Area -->
      <div class="hero-content relative z-20 max-w-7xl mx-auto px-6 w-full h-full flex flex-col lg:flex-row items-center justify-between gap-12 pt-20">

        <!-- Left Content -->
        <div class="flex-1 text-left mt-10 lg:mt-0">
          <div class="hero-badge reveal-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white text-xs font-bold uppercase tracking-widest mb-8 shadow-xl shadow-black/20">
            <span class="badge-dot"></span>
            MusicFlow AI
          </div>
          <h1 class="hero-headline reveal-up text-5xl lg:text-7xl xl:text-8xl font-extrabold text-white leading-[1.05] tracking-tight mb-8 drop-shadow-2xl">
            Âm nhạc hiểu bạn <br/><span class="accent-text text-transparent bg-clip-text bg-gradient-to-r from-white to-[#B8C1D1]">hơn mỗi ngày.</span>
          </h1>
          <p class="hero-subtitle reveal-up text-lg lg:text-xl text-[#B8C1D1] max-w-xl mb-12 leading-relaxed drop-shadow-md font-medium">
            Nghe nhạc, khám phá nghệ sĩ và tạo playlist cá nhân hóa dựa trên hành vi nghe thực tế của bạn.
          </p>
          <div class="hero-cta-group reveal-up flex flex-wrap items-center gap-5">
            <RouterLink to="/login" class="btn-primary bg-[#1ED760] text-black px-9 py-4 rounded-full font-bold text-lg hover:scale-105 hover:bg-[#1fdf64] transition-all shadow-[0_0_30px_rgba(30,215,96,0.25)]">
              Bắt đầu miễn phí
            </RouterLink>
            <a href="#features" class="btn-secondary px-9 py-4 rounded-full font-bold text-white text-lg border border-white/20 hover:border-white hover:bg-white/10 backdrop-blur-md transition-all">
              Xem Demo
            </a>
          </div>
        </div>

        <!-- Right Content: Floating Stage Card -->
        <div class="reveal-right float-animation relative w-full max-w-lg xl:max-w-xl mx-auto lg:ml-auto mt-12 lg:mt-0 perspective-1000">
          <!-- Stage Arc Glow behind the card -->
          <div class="absolute -top-32 -inset-x-20 h-80 bg-gradient-to-b from-[#1ED760]/20 via-[#8B5CF6]/10 to-transparent blur-[80px] rounded-[100%] pointer-events-none transform rotate-12"></div>
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#111827]/50 blur-[100px] rounded-full pointer-events-none"></div>

          <!-- Stage Card -->
          <div class="hero-card relative bg-[#151A28]/80 backdrop-blur-3xl rounded-3xl border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden transform-gpu hover:-translate-y-2 transition-transform duration-500">
            <div class="p-8">
              <div class="flex items-center justify-between mb-8">
                <span class="text-xs font-bold uppercase tracking-widest text-[#1ED760] flex items-center gap-2">
                  <span class="w-1.5 h-1.5 bg-[#1ED760] rounded-full animate-pulse"></span>
                  Now Playing
                </span>
                <MfIcon name="more_horiz" size="24" class="text-white/50 cursor-pointer hover:text-white transition-colors" />
              </div>
              
              <div class="flex items-end justify-between mb-8">
                <div>
                  <h3 class="text-3xl font-extrabold text-white mb-2 drop-shadow-md">Daily Mix #01</h3>
                  <p class="text-base text-[#B8C1D1] font-medium">Dựa trên gu nghe nhạc của bạn</p>
                </div>
                <button class="w-16 h-16 bg-[#1ED760] text-black rounded-full flex items-center justify-center shadow-2xl hover:scale-105 hover:bg-[#1fdf64] transition-all shrink-0 group">
                  <MfIcon name="play" size="32" filled class="ml-1 group-hover:scale-110 transition-transform" />
                </button>
              </div>

              <!-- Song List -->
              <div class="space-y-4">
                <div v-for="(song, index) in landingDemoData.songs" :key="index" class="flex items-center gap-4 group cursor-pointer p-2 -mx-2 rounded-xl hover:bg-white/5 transition-colors">
                  <div class="w-14 h-14 rounded-lg bg-[#111827] border border-white/5 flex items-center justify-center shrink-0 shadow-md relative overflow-hidden">
                     <img v-if="song.cover" :src="apiMediaUrl(song.cover)" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                     <!-- CSS Mini Equalizer overlay on hover -->
                     <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5 backdrop-blur-sm">
                       <span class="w-1 bg-[#1ED760] rounded-full h-3 animate-[equalizer_1s_ease-in-out_infinite]"></span>
                       <span class="w-1 bg-[#1ED760] rounded-full h-5 animate-[equalizer_1.2s_ease-in-out_infinite_0.1s]"></span>
                       <span class="w-1 bg-[#1ED760] rounded-full h-2 animate-[equalizer_0.9s_ease-in-out_infinite_0.2s]"></span>
                     </div>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-white font-bold text-base truncate group-hover:text-[#1ED760] transition-colors">{{ song.title }}</p>
                    <p class="text-[#8B93A7] text-sm font-medium truncate mt-0.5">{{ song.artist }}</p>
                  </div>
                  <div class="text-sm font-medium text-[#8B93A7] group-hover:text-white transition-colors">{{ song.duration }}</div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="mt-8 pt-6 border-t border-white/10">
                <div class="h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer group/progress relative">
                  <div class="absolute inset-0 bg-white/5"></div>
                  <div class="h-full bg-[#1ED760] w-[45%] rounded-full relative group-hover/progress:bg-[#1fdf64]">
                    <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover/progress:scale-100 transition-transform"></div>
                  </div>
                </div>
                <div class="flex justify-between mt-3 text-xs text-[#8B93A7] font-bold tracking-wider">
                  <span>1:42</span>
                  <span>-2:03</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>

    <main class="pb-24">
      <!-- Personalization Grid -->
      <section id="features" class="personalization-section section-line max-w-7xl mx-auto px-6 py-28">
        <div class="mb-20 reveal-up">
          <h2 class="text-4xl lg:text-5xl font-extrabold text-white mb-6 tracking-tight">Mọi thứ được cá nhân hóa</h2>
          <p class="text-[#8B93A7] text-xl font-medium max-w-2xl">Hệ thống phân tích hành vi và tạo ra một không gian âm nhạc dành riêng cho bạn.</p>
        </div>

        <div class="stagger-children grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Card 1: Dành cho bạn -->
          <div class="personalization-card reveal-up glass-card bg-[#111827] rounded-3xl p-10 border border-white/5 hover:bg-[#151A28] hover:border-white/10 transition-all flex flex-col justify-between group cursor-pointer shadow-xl hover:shadow-2xl">
            <div>
              <h3 class="text-3xl font-bold text-white mb-3">Dành cho bạn</h3>
              <p class="text-[#8B93A7] text-base font-medium">Playlist được cập nhật mỗi tuần dựa trên gu nhạc của bạn.</p>
            </div>
            <div class="mt-10 flex items-center gap-6">
              <div class="w-32 h-32 rounded-xl bg-[#1B2235] shadow-2xl flex-shrink-0 relative overflow-hidden border border-white/10">
                <img :src="apiMediaUrl('/uploads/playlist_cover/weeklymix.png')" alt="Weekly Mix" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <div class="w-12 h-12 bg-[#1ED760] rounded-full flex items-center justify-center shadow-lg transform scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300">
                     <MfIcon name="play" size="24" filled class="text-black ml-1" />
                   </div>
                </div>
              </div>
              <div>
                <p class="text-white font-bold text-2xl drop-shadow-sm mb-1">Weekly Mix</p>
                <p class="text-sm font-medium text-[#8B93A7] mb-4">20 bài hát • 1 giờ 24 phút</p>
                <span class="bg-white/10 text-white text-xs font-bold px-4 py-2 rounded-full uppercase tracking-wider group-hover:bg-white group-hover:text-black transition-colors">Khám phá</span>
              </div>
            </div>
          </div>

          <!-- Card 2: Khám phá nghệ sĩ -->
          <div class="personalization-card reveal-up glass-card bg-[#111827] rounded-3xl p-10 border border-white/5 hover:bg-[#151A28] hover:border-white/10 transition-all flex flex-col justify-between cursor-pointer group shadow-xl hover:shadow-2xl">
            <div>
              <h3 class="text-3xl font-bold text-white mb-3">Khám phá nghệ sĩ</h3>
              <p class="text-[#8B93A7] text-base font-medium">Kết nối với những giọng ca đồng điệu.</p>
            </div>
            <div class="mt-10 flex items-center gap-6">
              <div class="w-28 h-28 rounded-full bg-[#1B2235] p-1 relative overflow-hidden shadow-2xl border border-white/10">
                <img :src="apiMediaUrl('/uploads/playlist_cover/top_artists.png')" class="absolute inset-0 w-full h-full object-cover rounded-full group-hover:scale-110 transition-transform duration-700" />
              </div>
              <div class="flex-1">
                <p class="text-white font-extrabold text-2xl mb-1">Top Artists</p>
                <p class="text-sm font-medium text-[#8B93A7] mb-4">Nghệ sĩ bạn yêu thích nhất</p>
                <span class="border border-white/20 text-white group-hover:border-white group-hover:bg-white group-hover:text-black px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-colors">
                  Xem thêm
                </span>
              </div>
            </div>
          </div>

          <!-- Card 3: AI Playlist -->
          <div class="ai-playlist-card reveal-up bg-[#111827] rounded-3xl p-10 border border-white/5 hover:bg-[#151A28] hover:border-white/10 transition-all md:col-span-2 shadow-xl">
            <div class="flex flex-col lg:flex-row gap-10 items-center">
              <div class="ai-input-block reveal-left flex-1 w-full">
                <h3 class="text-3xl font-bold text-white mb-3">AI Playlist</h3>
                <p class="text-[#8B93A7] text-base font-medium mb-8">Mô tả tâm trạng bằng ngôn ngữ tự nhiên, hệ thống sẽ tạo một playlist hoàn hảo cho riêng bạn.</p>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MfIcon name="search" size="20" class="text-[#1ED760]" />
                  </div>
                  <input type="text" disabled class="block w-full pl-12 pr-4 py-4 bg-[#1B2235] border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#1ED760] text-sm font-medium" placeholder="Nhạc acoustic chill để code đêm khuya..." />
                  <div class="absolute inset-y-0 right-2 flex items-center">
                     <button disabled class="bg-[#1ED760] text-black px-4 py-2 rounded-lg font-bold text-sm">Tạo</button>
                  </div>
                </div>
              </div>

              <div class="ai-result-block reveal-right flex-1 w-full bg-[#090B14] rounded-2xl p-6 border border-white/5 shadow-inner">
                <p class="text-xs font-bold text-[#8B93A7] uppercase tracking-wider mb-4">Kết quả gợi ý</p>
                <div class="space-y-4">
                  <div class="ai-playlist-item reveal-up flex items-center gap-4" v-for="(song, i) in landingDemoData.aiSongs" :key="i">
                    <div class="w-10 h-10 rounded bg-[#1B2235] overflow-hidden shrink-0">
                      <img :src="apiMediaUrl(song.cover)" class="w-full h-full object-cover opacity-80" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-white text-sm font-bold truncate">{{ song.title }}</p>
                      <p class="text-[#8B93A7] text-xs font-medium truncate">{{ song.artist }}</p>
                    </div>
                    <MfIcon name="check_circle" size="18" class="text-[#1ED760]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Smart Workflow Timeline -->
      <section class="workflow-section section-line max-w-7xl mx-auto px-6 py-28 border-t border-white/5 bg-gradient-to-b from-[#090B14] to-[#111827]/30">
        <div class="workflow-grid-bg" aria-hidden="true"></div>
        <div class="relative">
          <div class="text-center mb-20 reveal-up">
            <h2 class="text-4xl lg:text-5xl font-extrabold text-white mb-6 tracking-tight">Luồng hoạt động thông minh</h2>
            <p class="text-[#8B93A7] text-xl font-medium">Quy trình cá nhân hóa diễn ra âm thầm phía sau mỗi lượt nghe.</p>
          </div>

          <div class="workflow-steps flex flex-col lg:flex-row items-center justify-between gap-8 max-w-5xl mx-auto relative">
            <!-- Desktop connecting line + progress fill -->
            <div class="hidden lg:block absolute top-12 left-16 right-16 h-1 bg-white/10 rounded-full z-0 overflow-hidden" aria-hidden="true">
              <div class="workflow-progress-fill h-full w-0 bg-gradient-to-r from-[#1ED760] to-[#3b82f6] rounded-full"></div>
            </div>

            <!-- Steps -->
            <div class="workflow-step reveal-up flex flex-col items-center w-full lg:w-1/4 relative z-10 group">
              <div class="step-number w-24 h-24 rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:border-white/30 transition-all duration-300">
                <MfIcon name="headphones" size="40" class="text-white" />
              </div>
              <h4 class="text-white font-bold text-xl mb-2">1. Nghe nhạc</h4>
              <p class="text-sm font-medium text-[#8B93A7] text-center px-4">Ghi nhận lịch sử và thói quen nghe nhạc của bạn.</p>
            </div>

            <MfIcon name="arrow_downward" size="24" class="lg:hidden text-white/20 my-2" />

            <div class="workflow-step reveal-up flex flex-col items-center w-full lg:w-1/4 relative z-10 group">
              <div class="step-number w-24 h-24 rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:border-white/30 transition-all duration-300">
                <MfIcon name="analytics" size="40" class="text-white" />
              </div>
              <h4 class="text-white font-bold text-xl mb-2">2. Phân tích hành vi</h4>
              <p class="text-sm font-medium text-[#8B93A7] text-center px-4">Xử lý dữ liệu tương tác, bỏ qua, lặp lại.</p>
            </div>

            <MfIcon name="arrow_downward" size="24" class="lg:hidden text-white/20 my-2" />

            <div class="workflow-step reveal-up flex flex-col items-center w-full lg:w-1/4 relative z-10 group">
              <div class="step-number w-24 h-24 rounded-2xl bg-[#111827] border border-[#1ED760]/20 flex items-center justify-center mb-6 shadow-xl group-hover:scale-110 group-hover:border-[#1ED760]/50 transition-all duration-300">
                <MfIcon name="auto_awesome" size="40" class="text-[#1ED760]" />
              </div>
              <h4 class="text-white font-bold text-xl mb-2">3. Gợi ý bài hát</h4>
              <p class="text-sm font-medium text-[#8B93A7] text-center px-4">Đối chiếu và tìm ra các bài hát có đặc điểm tương đồng.</p>
            </div>

            <MfIcon name="arrow_downward" size="24" class="lg:hidden text-[#1ED760]/50 my-2" />

            <div class="workflow-step reveal-up flex flex-col items-center w-full lg:w-1/4 relative z-10 group">
              <div class="step-number w-24 h-24 rounded-2xl bg-[#1ED760] flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(30,215,96,0.3)] group-hover:scale-110 group-hover:shadow-[0_0_40px_rgba(30,215,96,0.5)] transition-all duration-300">
                <MfIcon name="playlist_play" size="48" class="text-black" />
              </div>
              <h4 class="text-white font-bold text-xl mb-2">4. Playlist cá nhân hóa</h4>
              <p class="text-sm font-medium text-[#8B93A7] text-center px-4">Đề xuất âm nhạc khớp hoàn toàn với gu của bạn.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Premium Comparison -->
      <section id="premium" class="pricing-section section-line max-w-5xl mx-auto px-6 py-28 border-t border-white/5">
        <div class="text-center mb-20 reveal-up">
          <h2 class="text-4xl lg:text-5xl font-extrabold text-white mb-6 tracking-tight">Trải nghiệm âm nhạc nâng cao</h2>
          <p class="text-[#8B93A7] text-xl font-medium">Nâng cấp để mở khóa toàn bộ tính năng cao cấp của hệ thống.</p>
        </div>

        <div class="stagger-children pricing-grid grid grid-cols-1 md:grid-cols-2 gap-10">
          <!-- Free Tier -->
          <div class="pricing-card glass-card reveal-up rounded-[2.5rem] p-12 border border-white/5 shadow-xl">
            <h3 class="text-2xl font-extrabold text-white mb-2">Miễn phí</h3>
            <p class="text-5xl font-black text-white mb-10 tracking-tight">0đ <span class="text-lg font-bold text-[#8B93A7]">/tháng</span></p>
            <ul class="space-y-6 mb-12">
              <li class="flex items-center gap-4">
                <MfIcon name="check_circle" size="24" class="text-white/40 shrink-0" />
                <span class="text-[#B8C1D1] font-semibold text-lg">Phát nhạc tiêu chuẩn</span>
              </li>
              <li class="flex items-center gap-4">
                <MfIcon name="check_circle" size="24" class="text-white/40 shrink-0" />
                <span class="text-[#B8C1D1] font-semibold text-lg">Khám phá nghệ sĩ & thể loại</span>
              </li>
              <li class="flex items-center gap-4">
                <MfIcon name="cancel" size="24" class="text-white/10 shrink-0" />
                <span class="text-[#8B93A7] font-semibold text-lg line-through">Trải nghiệm không quảng cáo</span>
              </li>
              <li class="flex items-center gap-4">
                <MfIcon name="cancel" size="24" class="text-white/10 shrink-0" />
                <span class="text-[#8B93A7] font-semibold text-lg line-through">Tạo AI Playlist không giới hạn</span>
              </li>
              <li class="flex items-center gap-4">
                <MfIcon name="cancel" size="24" class="text-white/10 shrink-0" />
                <span class="text-[#8B93A7] font-semibold text-lg line-through">Chất lượng âm thanh nâng cao</span>
              </li>
            </ul>
            <RouterLink to="/login" class="block w-full py-4 text-center rounded-full font-bold text-white text-lg border-2 border-white/10 hover:border-white/30 hover:bg-white/5 transition-all">
              Đăng ký miễn phí
            </RouterLink>
          </div>

          <!-- Premium Tier -->
          <div class="pricing-card glass-card premium reveal-up rounded-[2.5rem] p-12 border border-[#1ED760]/30 relative shadow-[0_30px_60px_rgba(30,215,96,0.1)] transform md:-translate-y-4">
            <div class="absolute -top-5 left-1/2 -translate-x-1/2 bg-[#1ED760] text-black text-sm font-black uppercase tracking-widest py-2 px-6 rounded-full shadow-lg shadow-[#1ED760]/30 border border-[#1fdf64]">Khuyên dùng</div>
            <div class="flex items-center gap-3 mb-2">
              <MfIcon name="workspace_premium" size="32" class="text-[#1ED760]" />
              <h3 class="text-2xl font-extrabold text-white">Premium</h3>
            </div>
            <p class="text-5xl font-black text-white mb-10 tracking-tight">59.000đ <span class="text-lg font-bold text-[#8B93A7]">/tháng</span></p>
            <ul class="space-y-6 mb-12">
              <li class="flex items-center gap-4">
                <MfIcon name="check_circle" size="24" class="text-[#1ED760] shrink-0" />
                <span class="text-white font-bold text-lg">Chất lượng âm thanh nâng cao</span>
              </li>
              <li class="flex items-center gap-4">
                <MfIcon name="check_circle" size="24" class="text-[#1ED760] shrink-0" />
                <span class="text-white font-bold text-lg">Trải nghiệm không quảng cáo</span>
              </li>
              <li class="flex items-center gap-4">
                <MfIcon name="check_circle" size="24" class="text-[#1ED760] shrink-0" />
                <span class="text-white font-bold text-lg">Tạo AI Playlist không giới hạn</span>
              </li>
              <li class="flex items-center gap-4">
                <MfIcon name="check_circle" size="24" class="text-[#1ED760] shrink-0" />
                <span class="text-white font-bold text-lg">Hỗ trợ tính năng Karaoke AI</span>
              </li>
              <li class="flex items-center gap-4">
                <MfIcon name="check_circle" size="24" class="text-[#1ED760] shrink-0" />
                <span class="text-white font-bold text-lg">Tải nhạc & nghe offline</span>
              </li>
            </ul>
            <RouterLink to="/login" class="block w-full py-4 text-center rounded-full font-bold bg-[#1ED760] text-black text-lg hover:bg-[#1fdf64] hover:scale-105 transition-all shadow-[0_0_30px_rgba(30,215,96,0.2)]">
              Dùng thử Premium
            </RouterLink>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="musicflow-footer reveal border-t border-white/5 bg-[#090B14] py-16">
      <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
        <div class="flex items-center gap-3 text-white font-extrabold text-2xl tracking-tight">
          <MfIcon name="music" size="32" class="text-[#1ED760]" />
          MusicFlow
        </div>
        <div class="flex flex-wrap justify-center gap-8 text-base text-[#8B93A7] font-semibold">
          <a href="#features" class="hover:text-white transition-colors">Tính năng</a>
          <a href="#premium" class="hover:text-white transition-colors">Premium</a>
          <RouterLink to="/login" class="hover:text-white transition-colors">AI Playlist</RouterLink>
          <RouterLink to="/login" class="hover:text-white transition-colors">Karaoke AI</RouterLink>
          <a href="#" class="hover:text-white transition-colors">Hỗ trợ</a>
        </div>
        <p class="text-sm font-medium text-[#8B93A7]">
          &copy; {{ new Date().getFullYear() }} MusicFlow.
        </p>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import MfIcon from '@/components/common/MfIcon.vue'
import { useScrollReveal } from '@/composables/useScrollReveal'

const landingRef = ref(null)
useScrollReveal(landingRef)

const apiMediaUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000'
  return `${baseUrl.replace(/\/api\/?$/, '')}${url}`
}

// Local mock data purely for landing page visual rendering
const landingDemoData = {
  songs: [
    { title: 'Chúng Ta Của Tương Lai', artist: 'Sơn Tùng M-TP', duration: '3:45', cover: '/uploads/playlist_cover/dailymix_01.png' },
    { title: 'Pink Venom', artist: 'BLACKPINK', duration: '3:06', cover: '/uploads/playlist_cover/dailymix_02.png' },
    { title: 'Cruel Summer', artist: 'Taylor Swift', duration: '2:58', cover: '/uploads/playlist_cover/dailymix_03.png' },
    { title: 'Super Shy', artist: 'NewJeans', duration: '2:34', cover: '/uploads/playlist_cover/dailymix_04.png' }
  ],
  aiSongs: [
    { title: 'Midnight City', artist: 'M83', cover: '/uploads/playlist_cover/Night_Vibes.png' },
    { title: 'Sunset Lover', artist: 'Petit Biscuit', cover: '/uploads/playlist_cover/Morning_Vibes.png' },
    { title: 'Lofi Study', artist: 'Chillhop', cover: '/uploads/playlist_cover/moodmix.png' }
  ]
}
</script>

<style scoped>
/* === Smooth scroll toàn trang === */
html {
  scroll-behavior: smooth;
}

/* === CSS Variables (scope dưới .musicflow-landing) === */
.musicflow-landing {
  --accent: #1ED760;
  --accent-dim: rgba(30, 215, 96, 0.15);
  --accent-glow: rgba(30, 215, 96, 0.35);
  --bg-glass: rgba(255, 255, 255, 0.03);
  --bg-glass-hover: rgba(255, 255, 255, 0.06);
  --border-glass: rgba(255, 255, 255, 0.08);
  --border-glass-hover: rgba(30, 215, 96, 0.25);
  --line-section: rgba(255, 255, 255, 0.06);
  --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.4);
  --shadow-glow-green: 0 0 40px rgba(30, 215, 96, 0.12);
  --transition-smooth: cubic-bezier(0.16, 1, 0.3, 1);
  --reveal-duration: 0.8s;
  --reveal-delay: 0s;
}

.musicflow-landing,
.musicflow-landing * {
  box-sizing: border-box;
}

/* === Reveal system === */
.musicflow-landing .reveal,
.musicflow-landing .reveal-up,
.musicflow-landing .reveal-left,
.musicflow-landing .reveal-right,
.musicflow-landing .reveal-scale,
.musicflow-landing .reveal-blur {
  opacity: 0;
  transition: opacity var(--reveal-duration) var(--transition-smooth),
              transform var(--reveal-duration) var(--transition-smooth),
              filter var(--reveal-duration) var(--transition-smooth);
  transition-delay: var(--reveal-delay, 0s);
  will-change: opacity, transform, filter;
}
.musicflow-landing .reveal.is-visible,
.musicflow-landing .reveal-up.is-visible,
.musicflow-landing .reveal-left.is-visible,
.musicflow-landing .reveal-right.is-visible,
.musicflow-landing .reveal-scale.is-visible,
.musicflow-landing .reveal-blur.is-visible {
  opacity: 1;
  transform: none;
  filter: none;
}
.musicflow-landing .reveal { transform: none; }
.musicflow-landing .reveal-up { transform: translateY(40px); }
.musicflow-landing .reveal-left { transform: translateX(-60px); }
.musicflow-landing .reveal-right { transform: translateX(60px); }
.musicflow-landing .reveal-scale { transform: scale(0.92); }
.musicflow-landing .reveal-blur { filter: blur(12px); transform: translateY(20px); }
.musicflow-landing .reveal-blur.is-visible { filter: blur(0); transform: none; }

/* === Stagger children === */
.musicflow-landing .stagger-children > .reveal-up:nth-child(1) { --reveal-delay: 0s; }
.musicflow-landing .stagger-children > .reveal-up:nth-child(2) { --reveal-delay: 0.12s; }
.musicflow-landing .stagger-children > .reveal-up:nth-child(3) { --reveal-delay: 0.24s; }
.musicflow-landing .stagger-children > .reveal-up:nth-child(4) { --reveal-delay: 0.36s; }
.musicflow-landing .stagger-children > .reveal-up:nth-child(5) { --reveal-delay: 0.48s; }
.musicflow-landing .stagger-children > .reveal-up:nth-child(6) { --reveal-delay: 0.60s; }
.musicflow-landing .stagger-children > .reveal-scale:nth-child(1) { --reveal-delay: 0s; }
.musicflow-landing .stagger-children > .reveal-scale:nth-child(2) { --reveal-delay: 0.15s; }
.musicflow-landing .stagger-children > .reveal-scale:nth-child(3) { --reveal-delay: 0.30s; }

/* === Reduced motion === */
@media (prefers-reduced-motion: reduce) {
  .musicflow-landing .reveal,
  .musicflow-landing .reveal-up,
  .musicflow-landing .reveal-left,
  .musicflow-landing .reveal-right,
  .musicflow-landing .reveal-scale,
  .musicflow-landing .reveal-blur {
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    transition: none !important;
  }
  .musicflow-landing .wave-glow-bg,
  .musicflow-landing .float-animation,
  .musicflow-landing .workflow-progress-fill {
    animation: none !important;
    transition: none !important;
  }
}

/* === Section line divider === */
.musicflow-landing .section-line {
  position: relative;
}
.musicflow-landing .section-line::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(80%, 1200px);
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--line-section) 20%,
    var(--line-section) 80%,
    transparent 100%);
}

/* === Wave glow background === */
.musicflow-landing .wave-glow-container {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}
.musicflow-landing .wave-glow-bg {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.35;
  animation: wavePulse 8s ease-in-out infinite;
}
.musicflow-landing .wave-glow-bg.green {
  background: radial-gradient(circle, rgba(30, 215, 96, 0.5) 0%, transparent 70%);
  width: 600px; height: 600px;
  top: 10%; left: 20%;
}
.musicflow-landing .wave-glow-bg.blue {
  background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, transparent 70%);
  width: 500px; height: 500px;
  top: 30%; right: 10%;
  animation-delay: -3s;
}
.musicflow-landing .wave-glow-bg.green-2 {
  background: radial-gradient(circle, rgba(30, 215, 96, 0.3) 0%, transparent 70%);
  width: 400px; height: 400px;
  bottom: 10%; left: 50%;
  animation-delay: -5s;
}
@keyframes wavePulse {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.35; }
  33% { transform: translate(30px, -20px) scale(1.1); opacity: 0.45; }
  66% { transform: translate(-20px, 15px) scale(0.95); opacity: 0.3; }
}

/* === Floating animation === */
.musicflow-landing .float-animation {
  animation: floatY 6s ease-in-out infinite;
}
@keyframes floatY {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}

/* === Hero delay variables === */
.musicflow-landing .hero-badge { --reveal-delay: 0s; }
.musicflow-landing .hero-headline { --reveal-delay: 0.1s; }
.musicflow-landing .hero-subtitle { --reveal-delay: 0.2s; }
.musicflow-landing .hero-cta-group { --reveal-delay: 0.3s; }
.musicflow-landing .hero-badge .badge-dot {
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
  animation: pulseDot 2s ease-in-out infinite;
}
@keyframes pulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

/* === Glass card === */
.musicflow-landing .glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid var(--border-glass);
  box-shadow: var(--shadow-card);
  transition: transform 0.4s var(--transition-smooth),
              border-color 0.4s var(--transition-smooth),
              box-shadow 0.4s var(--transition-smooth);
}
.musicflow-landing .glass-card:hover {
  transform: translateY(-6px);
  border-color: var(--border-glass-hover);
  box-shadow: var(--shadow-card), var(--shadow-glow-green);
}
.musicflow-landing .glass-card.premium {
  background: linear-gradient(180deg, rgba(30, 215, 96, 0.05), var(--bg-glass));
  border-color: rgba(30, 215, 96, 0.2);
  box-shadow: var(--shadow-card), 0 0 60px rgba(30, 215, 96, 0.08);
}
.musicflow-landing .glass-card.premium:hover {
  border-color: rgba(30, 215, 96, 0.45);
  box-shadow: var(--shadow-card), 0 0 80px rgba(30, 215, 96, 0.18);
}

/* === Personalization hover subtle === */
.musicflow-landing .personalization-card {
  transition: transform 0.4s var(--transition-smooth),
              border-color 0.4s var(--transition-smooth),
              box-shadow 0.4s var(--transition-smooth);
}
.musicflow-landing .personalization-card:hover {
  border-color: var(--border-glass-hover);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(30, 215, 96, 0.08);
}

/* === AI playlist stagger === */
.musicflow-landing .ai-playlist-item {
  --reveal-delay: calc(var(--item-index, 0) * 0.08s);
}

/* === Workflow grid + progress === */
.musicflow-landing .workflow-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--line-section) 1px, transparent 1px),
    linear-gradient(90deg, var(--line-section) 1px, transparent 1px);
  background-size: 60px 60px;
  opacity: 0.5;
  pointer-events: none;
  z-index: 0;
}
.musicflow-landing .workflow-progress-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, var(--accent), #3b82f6);
  transition: width 1.5s var(--transition-smooth);
  box-shadow: 0 0 10px rgba(30, 215, 96, 0.3);
}
.musicflow-landing .workflow-progress-fill.is-visible {
  width: 100%;
}
.musicflow-landing .workflow-step {
  --reveal-delay: calc(var(--step-index, 0) * 0.2s);
}
.musicflow-landing .workflow-step .step-number {
  transition: all 0.5s var(--transition-smooth);
}
.musicflow-landing .workflow-step.is-visible .step-number {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: 0 0 20px rgba(30, 215, 96, 0.15);
}

/* === Pricing card === */
.musicflow-landing .pricing-card {
  padding: 40px 32px;
  border-radius: 24px;
  background: var(--bg-glass);
  border: 1px solid var(--border-glass);
  transition: all 0.4s var(--transition-smooth);
  display: flex;
  flex-direction: column;
}
.musicflow-landing .pricing-card:hover {
  transform: translateY(-6px);
  border-color: var(--border-glass-hover);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3), 0 0 30px rgba(30, 215, 96, 0.06);
}
.musicflow-landing .pricing-card.premium {
  background: linear-gradient(180deg, rgba(30, 215, 96, 0.05), var(--bg-glass));
  border-color: rgba(30, 215, 96, 0.2);
  position: relative;
  overflow: hidden;
}
.musicflow-landing .pricing-card.premium::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
}
.musicflow-landing .pricing-card.premium:hover {
  border-color: rgba(30, 215, 96, 0.4);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3), 0 0 50px rgba(30, 215, 96, 0.12);
}

/* === Footer top divider mảnh === */
.musicflow-landing .musicflow-footer {
  position: relative;
}
.musicflow-landing .musicflow-footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: min(80%, 1200px);
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--line-section) 20%,
    var(--line-section) 80%,
    transparent 100%);
}

/* === Equalizer keyframes (giữ nguyên cho mini equalizer hero card) === */
@keyframes equalizer {
  0%, 100% { height: 4px; }
  50% { height: 16px; }
}

/* === Responsive 390px (mobile) === */
@media (max-width: 1024px) {
  .musicflow-landing .hero-content {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .musicflow-landing .hero-subtitle {
    margin-left: auto;
    margin-right: auto;
  }
  .musicflow-landing .hero-cta-group {
    justify-content: center;
  }
  .musicflow-landing .hero-card {
    margin: 0 auto;
  }
}
@media (max-width: 768px) {
  .musicflow-landing .hero-section {
    padding: 100px 20px 60px;
  }
  .musicflow-landing .personalization-card,
  .musicflow-landing .ai-playlist-card {
    padding: 24px;
  }
  .musicflow-landing .pricing-card {
    padding: 28px 24px;
  }
  .musicflow-landing .pricing-grid {
    grid-template-columns: 1fr;
  }
  .musicflow-landing .workflow-steps {
    flex-direction: column;
    gap: 40px;
  }
  /* Mobile workflow: ẩn progress line, dùng layout dọc ngang step */
  .musicflow-landing .workflow-steps > .hidden.lg\:block {
    display: none !important;
  }
  .musicflow-landing .workflow-step {
    text-align: left;
    display: flex;
    flex-direction: row;
    gap: 20px;
    align-items: flex-start;
  }
  .musicflow-landing .workflow-step .step-number {
    margin: 0;
    flex-shrink: 0;
    width: 60px;
    height: 60px;
    font-size: 1.25rem;
  }
  .musicflow-landing .mf-navbar .nav-links,
  .musicflow-landing .mf-navbar > div > div.hidden.md\:flex {
    display: none;
  }
  .musicflow-landing .musicflow-footer > div {
    flex-direction: column;
    text-align: center;
  }
}
</style>
