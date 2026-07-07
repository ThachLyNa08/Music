<template>
  <div class="messages-shell flex h-full min-h-0 w-full overflow-hidden bg-[#0f1117] text-white font-sans">
    <!-- SIDEBAR -->
    <aside class="flex h-full min-h-0 w-[300px] shrink-0 flex-col overflow-hidden border-r border-[#1f232e] bg-[#0f1117]">
      <!-- Header -->
      <div class="p-3.5 pb-2.5 border-b border-[#1f232e] shrink-0">
        <div class="flex items-center justify-between mb-1">
          <div>
            <h1 class="text-lg font-bold tracking-tight m-0 text-white">Tin nhắn</h1>
            <p class="text-[11px] text-gray-500 mt-0.5 m-0">Hãy bắt đầu chia sẽ cùng nhau</p>
          </div>
          <button
            class="w-8 h-8 shrink-0 rounded-full bg-[#1f232e] hover:bg-[#2a2f3d] flex items-center justify-center transition-colors text-gray-400"
            type="button"
            title="Tải lại"
            @click="loadConversations"
          >
            <MfIcon name="refresh" size="14" />
          </button>
        </div>
      </div>

      <!-- Search -->
      <div class="px-3.5 py-2.5 border-b border-[#1f232e] shrink-0">
        <div class="relative">
          <MfIcon name="search" size="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm người dùng"
            class="w-full bg-[#1f232e] text-[13px] text-white placeholder-gray-600 rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition border-none"
          />
        </div>
        
        <!-- Search Results Dropdown -->
        <div
          v-if="searchQuery.trim()"
          class="scrollbar-thin mt-2 max-h-60 overflow-y-auto rounded-xl border border-[#2a2f3d] bg-[#1f232e] shadow-lg absolute z-20 w-[calc(320px-2rem)]"
        >
          <div v-if="searchLoading" class="px-4 py-4 text-center text-sm font-semibold text-gray-500">Đang tìm...</div>
          <button
            v-for="user in searchResults"
            :key="user.id"
            class="flex w-full items-center gap-3 border-0 border-b border-[#2a2f3d] bg-transparent px-3 py-3 text-left transition last:border-b-0 hover:bg-[#2a2f3d]"
            type="button"
            @click="openDirectConversation(user)"
          >
            <UserAvatar :user="user" size-class="h-9 w-9" />
            <div class="min-w-0">
              <div class="truncate text-[13px] font-bold text-white">{{ displayUserName(user) }}</div>
            </div>
          </button>
          <div v-if="!searchLoading && searchResults.length === 0" class="px-4 py-4 text-center text-sm font-semibold text-gray-500">
            Không tìm thấy người dùng
          </div>
        </div>
      </div>

      <!-- Conversation List -->
      <div class="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-0.5 scrollbar-thin relative">
        <div v-if="loadingConversations" class="px-4 py-8 text-center text-sm font-semibold text-gray-500">Đang tải cuộc trò chuyện...</div>
        
        <button
          v-for="conversation in conversations"
          :key="conversation.conversation_id"
          class="flex w-full items-center gap-3 p-2.5 rounded-xl transition group text-left border"
          :class="[
            activeConversation?.conversation_id === conversation.conversation_id 
              ? 'bg-[#1f232e] border-transparent' 
              : (conversation.unread_count > 0 ? 'bg-[#6366f1]/[0.05] border-[#6366f1]/30 hover:bg-[#1f232e]' : 'border-transparent hover:bg-[#1f232e]')
          ]"
          type="button"
          @click="selectConversation(conversation)"
        >
          <div class="relative shrink-0">
            <UserAvatar 
              :user="conversation.other_user" 
              size-class="w-10 h-10" 
              :class="conversation.unread_count > 0 ? 'ring-2 ring-[#6366f1] ring-offset-2 ring-offset-[#0f1117]' : ''" 
            />
            <div v-if="conversation.other_user?.online" class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#0f1117]"></div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <span class="text-[13px] truncate" :class="conversation.unread_count > 0 ? 'font-bold text-white' : 'font-semibold text-gray-200'">{{ displayUserName(conversation.other_user) }}</span>
              <span class="text-[10px] whitespace-nowrap ml-2" :class="conversation.unread_count > 0 ? 'text-[#6366f1] font-semibold' : 'text-gray-500'">{{ formatConversationTime(conversation.last_message?.created_at || conversation.updated_at) }}</span>
            </div>
            <div class="flex items-center justify-between gap-2 mt-0.5">
              <p class="text-[11px] truncate m-0" :class="conversation.unread_count > 0 ? 'text-[#6366f1] font-bold' : 'text-gray-500'">
                <span class="truncate">{{ conversationPreview(conversation) }}</span>
              </p>
              <span
                v-if="conversation.unread_count > 0"
                class="w-[18px] h-[18px] bg-[#6366f1] text-white text-[9px] font-bold rounded-full flex items-center justify-center shrink-0"
              >
                {{ conversation.unread_count > 9 ? '9+' : conversation.unread_count }}
              </span>
            </div>
          </div>
        </button>

        <div v-if="!loadingConversations && conversations.length === 0" class="px-6 py-14 text-center">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1f232e]">
            <MfIcon name="chat" size="28" className="text-gray-500" />
          </div>
          <p class="mt-3 text-sm font-bold text-gray-400">Chưa có cuộc trò chuyện nào</p>
          <p class="mt-1 text-xs font-medium text-gray-600">Tìm người dùng để bắt đầu nhắn tin.</p>
        </div>
      </div>
    </aside>

    <!-- MAIN CHAT AREA -->
    <section class="flex-1 min-w-0 h-full min-h-0 flex flex-col overflow-hidden bg-[#0f1117] relative">
      <template v-if="activeConversation">
        <!-- Chat Header -->
        <div class="h-[60px] shrink-0 border-b border-[#1f232e] flex items-center justify-between px-5 bg-[#0f1117]/95 backdrop-blur z-10 relative">
          <!-- Left: User Info -->
          <div class="flex min-w-0 items-center gap-3">
            <button
              class="flex min-w-0 items-center gap-3.5 bg-transparent text-left transition hover:opacity-80"
              type="button"
              title="Xem trang cá nhân"
              @click="openUserProfile(activeConversation.other_user.id)"
            >
              <div class="relative shrink-0">
                <UserAvatar :user="activeConversation.other_user" size-class="w-[38px] h-[38px]" />
                <div v-if="activeConversation.other_user.online" class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#0f1117]"></div>
                <div v-else class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-gray-500 border-2 border-[#0f1117]"></div>
              </div>
              <div class="min-w-0 flex flex-col justify-center text-left">
                <h2 class="truncate text-[14px] font-bold text-white m-0 leading-tight">{{ displayUserName(activeConversation.other_user) }}</h2>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span v-if="activeConversation.other_user.online" class="text-[11px] text-green-400 font-medium">Đang hoạt động</span>
                  <span v-else class="text-[11px] text-gray-500 font-medium">Ngoại tuyến</span>
                </div>
              </div>
            </button>
          </div>

          <!-- Right: Now Playing + Refresh -->
          <div class="flex items-center gap-4 shrink-0">
            <!-- Now Playing Mini Banner (Desktop) -->
            <div v-if="peerNowPlaying" class="hidden sm:flex items-center gap-2.5 bg-[#1f232e] rounded-full p-1 pr-3 cursor-pointer hover:bg-[#2a2f3d] transition animate-fade-in" @click="playSharedSong(peerNowPlaying)">
              <div class="w-7 h-7 rounded-full bg-black relative overflow-hidden shrink-0">
                <img :src="songCover(peerNowPlaying)" alt="" class="w-full h-full object-cover" />
              </div>
              <div class="min-w-0 flex flex-col justify-center max-w-[150px]">
                <p class="text-[9px] text-green-400 m-0 leading-tight mb-[1px] font-bold uppercase tracking-wider truncate">{{ activeConversation.other_user?.display_name }} đang nghe</p>
                <p class="text-[11px] text-white truncate m-0 font-semibold leading-tight">
                  {{ peerNowPlaying.title }} <span class="font-normal text-gray-500 mx-0.5">•</span> <span class="font-normal text-gray-400">{{ songArtist(peerNowPlaying) }}</span>
                </p>
              </div>
              <MfIcon name="play_circle" size="14" className="text-green-400 ml-1" />
            </div>
            <div v-else-if="player.currentSong && player.isPlaying" class="hidden sm:flex items-center gap-2.5 bg-[#1f232e] rounded-full p-1 pr-1 animate-fade-in">
              <div class="w-7 h-7 rounded-full bg-black relative overflow-hidden shrink-0">
                <img :src="songCover(player.currentSong)" alt="" class="w-full h-full object-cover" />
              </div>
              <div class="min-w-0 flex flex-col justify-center max-w-[150px] pr-2">
                <p class="text-[9px] text-[#6366f1] m-0 leading-tight mb-[1px] font-bold uppercase tracking-wider truncate">Bạn đang nghe</p>
                <p class="text-[11px] text-white truncate m-0 font-semibold leading-tight">
                  {{ player.currentSong.title }} <span class="font-normal text-gray-500 mx-0.5">•</span> <span class="font-normal text-gray-400">{{ songArtist(player.currentSong) }}</span>
                </p>
              </div>
              <button
                class="text-[10px] font-bold text-white hover:text-white w-7 h-7 flex items-center justify-center rounded-full bg-[#6366f1] hover:bg-[#4f46e5] transition shrink-0 shadow shadow-[#6366f1]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                @click="shareCurrentSong"
                :disabled="sending"
                title="Chia sẻ bài hát này"
              >
                <MfIcon name="share" size="12" />
              </button>
            </div>

            <button
              class="w-8 h-8 shrink-0 rounded-full bg-[#1f232e] hover:bg-[#2a2f3d] flex items-center justify-center transition-colors text-gray-400"
              type="button"
              title="Tải lại tin nhắn"
              @click="loadMessages(activeConversation.conversation_id)"
            >
              <MfIcon name="refresh" size="15" />
            </button>
          </div>
        </div>

        <!-- Mobile Now Playing Banner -->
        <div v-if="peerNowPlaying" class="sm:hidden w-full bg-[#1f232e]/80 backdrop-blur border-b border-[#2a2f3d] px-4 py-2 flex items-center justify-between cursor-pointer animate-fade-in" @click="playSharedSong(peerNowPlaying)">
          <div class="flex items-center gap-3 min-w-0">
            <img :src="songCover(peerNowPlaying)" alt="" class="w-8 h-8 rounded-full object-cover shrink-0" />
            <div class="min-w-0 flex flex-col">
              <span class="text-[10px] text-green-400 font-bold truncate uppercase tracking-wider">{{ activeConversation.other_user?.display_name }} đang nghe</span>
              <span class="text-xs text-white font-semibold truncate">{{ peerNowPlaying.title }}</span>
            </div>
          </div>
          <MfIcon name="play_circle" size="18" className="text-green-400 shrink-0" />
        </div>
        <div v-else-if="player.currentSong && player.isPlaying" class="sm:hidden w-full bg-[#1f232e]/80 backdrop-blur border-b border-[#2a2f3d] px-4 py-2 flex items-center justify-between animate-fade-in">
          <div class="flex items-center gap-3 min-w-0">
            <img :src="songCover(player.currentSong)" alt="" class="w-8 h-8 rounded-full object-cover shrink-0" />
            <div class="min-w-0 flex flex-col">
              <span class="text-[10px] text-[#6366f1] font-bold truncate uppercase tracking-wider">Bạn đang nghe</span>
              <span class="text-xs text-white font-semibold truncate">{{ player.currentSong.title }}</span>
            </div>
          </div>
          <button @click="shareCurrentSong" :disabled="sending" class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#6366f1] text-white">
            <MfIcon name="share" size="14" />
          </button>
        </div>

        <!-- Messages Area -->
        <div ref="messageListRef" class="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 scrollbar-thin">
          <div v-if="loadingMessages" class="py-12 text-center text-sm font-semibold text-gray-500">Đang tải tin nhắn...</div>
          <div v-else-if="messages.length === 0" class="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1f232e]">
              <MfIcon name="chat" size="28" className="text-gray-500" />
            </div>
            <p class="mt-3 text-sm font-bold text-gray-400">Gửi lời chào đầu tiên</p>
          </div>
          <div v-else class="flex flex-col gap-4 pb-2">
            <template v-for="(group, groupIndex) in groupedMessages" :key="'group-' + groupIndex">
              <!-- Date divider -->
              <div v-if="showDateDividerForGroup(groupIndex)" class="flex items-center justify-center gap-3 my-2">
                <div class="h-px bg-[#1f232e] flex-1"></div>
                <span class="text-[10px] text-gray-600 font-medium">{{ formatDateDivider(group.start_time) }}</span>
                <div class="h-px bg-[#1f232e] flex-1"></div>
              </div>

              <!-- Message Group -->
              <div class="flex items-end gap-2 max-w-[85%] sm:max-w-[70%]" :class="group.isOwn ? 'ml-auto justify-end' : ''">
                <UserAvatar
                  v-if="!group.isOwn"
                  :user="activeConversation.other_user"
                  size-class="w-6 h-6 mb-1.5 shrink-0"
                />
                
                <div class="flex flex-col gap-1 min-w-0" :class="group.isOwn ? 'items-end' : 'items-start'">
                  <div
                    v-for="(message, msgIndex) in group.messages"
                    :key="message.id"
                    class="flex flex-col gap-1"
                    :class="group.isOwn ? 'items-end' : 'items-start'"
                  >
                    <div
                      :id="'msg-' + message.id"
                      class="group/message flex items-center gap-2 relative rounded-2xl transition-colors duration-500"
                      :class="group.isOwn ? 'flex-row-reverse' : 'flex-row'"
                    >
                    <!-- Bubble Wrapper -->
                    <div class="flex flex-col min-w-0" :class="group.isOwn ? 'items-end' : 'items-start'">
                    
                      <!-- Quoted Block -->
                      <div v-if="message.reply_to" 
                           @click="scrollToMessage(message.reply_to.id)"
                           class="mb-1 rounded-xl px-2.5 py-1.5 text-[11px] cursor-pointer hover:opacity-80 transition max-w-[240px] sm:max-w-[320px] border-l-2"
                           :class="group.isOwn ? 'bg-white/10 border-white/50 text-gray-300' : 'bg-black/20 border-[#6366f1] text-gray-400'">
                        <div class="font-bold mb-0.5 truncate" :class="group.isOwn ? 'text-white' : 'text-[#6366f1]'">
                          {{ message.reply_to.sender_name || 'Người dùng' }}
                        </div>
                        <div class="truncate opacity-90">
                          <template v-if="message.reply_to.message_type === 'song_share'">
                            <MfIcon name="music_note" size="11" className="inline mr-0.5" />
                            {{ message.reply_to.shared_song?.title || 'Bài hát' }}
                          </template>
                          <template v-else-if="message.reply_to.message_type === 'recalled'">
                            <i class="opacity-70">Tin nhắn đã được thu hồi</i>
                          </template>
                          <template v-else>
                            {{ message.reply_to.body }}
                          </template>
                        </div>
                      </div>

                    <!-- Bubble -->
                    <div
                      class="text-left leading-relaxed overflow-wrap-anywhere relative select-none"
                      @dblclick="message.message_type !== 'recalled' && toggleReaction(message.id, '❤️')"
                      @contextmenu.prevent="typeof message.id === 'number' && openActionMenu(message, $event)"
                      style="-webkit-touch-callout: none;"
                      :class="[
                        group.isOwn ? 'bg-[#6366f1] text-white' : 'bg-[#1f232e] text-gray-300',
                        message.message_type === 'song_share' ? 'p-0 overflow-hidden' : 'px-3 py-2 text-[13px]',
                        getBubbleShape(group.isOwn, group.messages.length, msgIndex),
                        message.status === 'sending' ? 'opacity-70' : '',
                        message.status === 'error' ? 'bg-red-500/20 text-red-200 border border-red-500/50' : '',
                        message.message_type === 'recalled' ? '!bg-transparent border border-gray-600 !text-gray-500 italic' : ''
                      ]"
                    >
                      <template v-if="message.message_type === 'song_share'">
                        <div
                          v-if="message.shared_song"
                          class="flex w-full min-w-[240px] max-w-[320px] cursor-pointer items-center gap-2.5 p-2 transition group/card relative"
                          :class="group.isOwn ? 'bg-black/10 hover:bg-black/20' : 'hover:bg-[#2a2f3d]'"
                          role="button"
                          tabindex="0"
                          title="Xem chi tiết bài hát"
                          @click="openSongDetail(message.shared_song)"
                          @keydown.enter.prevent="openSongDetail(message.shared_song)"
                        >
                          <div class="w-[60px] h-[60px] rounded-lg bg-black/20 flex items-center justify-center relative overflow-hidden shrink-0 group/cover">
                            <img
                              :src="songCover(message.shared_song)"
                              alt=""
                              class="w-full h-full object-cover"
                              @error="event => event.target.src = '/default-cover.png'"
                            />
                            <button
                              class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition"
                              type="button"
                              title="Phát bài hát"
                              @click.stop="playSharedSong(message.shared_song)"
                            >
                              <MfIcon name="play_arrow" size="28" className="text-white" />
                            </button>
                          </div>
                          <div class="min-w-0 flex-1 pt-0.5">
                            <div class="truncate text-[15px] font-bold text-white">{{ message.shared_song.title }}</div>
                            <div class="mt-0.5 flex items-center justify-between gap-2">
                              <div class="truncate text-[13px]" :class="group.isOwn ? 'text-white/80' : 'text-gray-400'">
                                {{ songArtist(message.shared_song) }}<template v-if="message.shared_song.album"> · {{ message.shared_song.album }}</template>
                              </div>
                              <div class="flex items-center shrink-0">
                                <LikeButton 
                                  :song="message.shared_song" 
                                  size="14" 
                                  baseClass="p-0.5 transition-all rounded-full"
                                  :class="group.isOwn ? 'hover:bg-black/20 text-white/90' : 'hover:bg-white/10 text-gray-400'"
                                />
                                <button
                                  class="p-0.5 rounded-full transition-colors flex items-center justify-center ml-0.5"
                                  :class="group.isOwn ? 'text-white/90 hover:bg-black/20 hover:text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
                                  type="button"
                                  title="Thêm vào hàng chờ"
                                  @click.stop="addToQueue(message.shared_song)"
                                >
                                  <MfIcon name="queue" size="14" />
                                </button>
                                <button
                                  class="p-0.5 rounded-full transition-colors flex items-center justify-center ml-0.5"
                                  :class="group.isOwn ? 'text-white/90 hover:bg-black/20 hover:text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'"
                                  type="button"
                                  title="Thêm"
                                  @click.stop="openSongMenu(message.shared_song, $event)"
                                >
                                  <MfIcon name="more_vert" size="14" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div v-else class="p-3 text-[13px] font-semibold opacity-80">Bài hát này không còn khả dụng.</div>
                        
                        <div v-if="message.body && !isDefaultShareBody(message)" class="px-3 pb-3 pt-1 whitespace-pre-wrap break-words text-[13px]" :class="group.isOwn ? 'text-white/90' : 'text-gray-300'">
                          {{ message.body }}
                        </div>
                      </template>
                      <div v-else class="whitespace-pre-wrap break-words">{{ message.body }}</div>
                    </div>

                    <!-- Reaction Badges -->
                    <div v-if="message.reactions && message.reactions.length > 0" class="flex flex-wrap gap-1 z-10 relative -mt-2.5 mb-1 self-end">
                      <button
                        v-for="r in message.reactions"
                        :key="r.emoji"
                        class="flex items-center justify-center transition cursor-pointer hover:scale-110"
                        :class="r.count > 1 ? 'gap-1' : ''"
                        @click="toggleReaction(message.id, r.emoji)"
                      >
                        <span class="text-[13px] leading-none drop-shadow-md" :class="r.reactedByMe ? 'scale-110' : ''">{{ r.emoji }}</span>
                        <span v-if="r.count > 1" class="text-[10px] font-bold drop-shadow-md" :class="r.reactedByMe ? 'text-[#6366f1]' : 'text-gray-400'">{{ r.count }}</span>
                      </button>
                    </div>
                    </div>
                    <!-- Options / Status -->
                    <div v-if="message.message_type !== 'recalled'" class="flex items-center gap-1 opacity-0 group-hover/message:opacity-100 transition" :class="message.status ? '!opacity-100' : ''">
                       <MfIcon v-if="message.status === 'sending'" name="schedule" size="14" className="text-gray-500" />
                       <button v-else-if="message.status === 'error'" @click="retryMessage(message)" class="text-red-500 hover:text-red-400 p-1" title="Lỗi. Bấm để gửi lại">
                         <MfIcon name="error" size="16" />
                       </button>
                       <template v-else>
                         <button @click="handleActionReply(message)" class="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white transition shrink-0" title="Trả lời">
                           <MfIcon name="reply" size="15" />
                         </button>
                         <div v-if="typeof message.id === 'number'" class="relative shrink-0">
                           <button @click="openActionMenu(message, $event)" class="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-white transition shrink-0" title="Thêm hành động">
                             <MfIcon name="add_reaction" size="15" />
                           </button>
                         </div>
                       </template>
                    </div>
                  </div>

                </div>
                  
                  <div class="flex items-center gap-1.5 px-1 mt-0.5" :class="group.isOwn ? 'justify-end' : 'justify-start'">
                    <span class="text-[9px] text-gray-600">{{ formatTime(group.end_time) }}</span>
                    <span v-if="group.isOwn && isGroupRead(group)" class="text-[10px] text-[#818cf8] flex items-center" title="Đã xem">
                      <MfIcon name="done_all" size="14" />
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- Input Area -->
        <form class="shrink-0 border-t border-[#1f232e] bg-[#0f1117] flex flex-col" @submit.prevent="sendMessage">
          <div v-if="replyingMessage" class="px-4 pt-3 pb-1 flex items-center justify-between bg-[#0f1117]">
             <div class="flex items-center gap-2 text-[12px] text-gray-400 min-w-0 border-l-2 border-[#6366f1] pl-2.5 py-0.5">
                <span class="truncate">Đang trả lời <b>{{ replyingMessage.sender?.display_name || replyingMessage.sender_name || 'Người dùng' }}</b>: {{ replyingMessage.message_type === 'song_share' ? ('Bài hát ' + (replyingMessage.shared_song?.title || '')) : replyingMessage.body }}</span>
             </div>
             <button type="button" @click="replyingMessage = null" class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white rounded-full hover:bg-[#2a2f3d] transition shrink-0 ml-2">
               <MfIcon name="close" size="14" />
             </button>
          </div>
          <div class="p-3 flex items-end gap-2.5">
            <textarea
              ref="messageInput"
              v-model="draft"
              class="flex-1 max-h-32 min-h-[40px] bg-[#1f232e] text-[13px] text-white placeholder-gray-600 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#6366f1]/30 transition border-none resize-none scrollbar-thin m-0"
              maxlength="1000"
              placeholder="Nhập tin nhắn..."
              rows="1"
              @keydown.enter.exact.prevent="sendMessage"
            />
            <button
              class="w-[40px] h-[40px] shrink-0 rounded-xl bg-[#6366f1] hover:bg-[#4f46e5] flex items-center justify-center text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              :disabled="!draft.trim() || sending"
              title="Gửi"
            >
              <MfIcon name="send" size="16" />
            </button>
          </div>
        </form>
      </template>

      <!-- Empty State -->
      <div v-else class="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <div class="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#1f232e]">
          <MfIcon name="chat" size="32" className="text-gray-500" />
        </div>
        <h2 class="mt-5 text-lg font-bold text-white m-0">Chọn một cuộc trò chuyện</h2>
        <p class="mt-2 max-w-sm text-sm text-gray-500 m-0">
          Tìm người dùng ở cột bên trái để bắt đầu nhắn tin.
        </p>
      </div>
    </section>

    <!-- Action Menu Popover -->
    <Teleport to="body">
      <div v-if="actionMenu.visible" class="fixed inset-0 z-40" @click="closeActionMenu" @contextmenu.prevent="closeActionMenu">
        <div 
          class="absolute bg-[#1f232e] border border-[#2a2f3d] shadow-xl rounded-2xl p-2 flex flex-col w-56 animate-fade-in"
          :style="{ top: actionMenu.y + 'px', left: actionMenu.x + 'px' }"
          @click.stop
        >
          <!-- Emoji Reactions -->
          <div class="flex items-center justify-between px-2 py-2 mb-1 border-b border-[#2a2f3d]">
            <button
              v-for="emoji in allowedEmojis"
              :key="emoji"
              class="w-8 h-8 flex items-center justify-center hover:bg-[#2a2f3d] rounded-full text-xl transition transform hover:scale-110 active:scale-95"
              @click="handleActionEmoji(emoji)"
            >
              {{ emoji }}
            </button>
          </div>
          
          <!-- Actions -->
          <button class="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-[#2a2f3d] rounded-xl transition w-full text-left mt-1" @click="handleActionReply(actionMenu.message)">
            <MfIcon name="reply" size="18" />
            Trả lời
          </button>

          <button v-if="actionMenu.message.sender_id === currentUserId" class="flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition w-full text-left" @click="handleActionRecall(actionMenu.message)">
            <MfIcon name="delete" size="18" />
            Thu hồi
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Confirm Modal -->
    <Teleport to="body">
      <div v-if="confirmModal.visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in">
        <div class="bg-[#1f232e] border border-[#2a2f3d] rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 transition-transform">
          <h3 class="text-[17px] font-bold text-white mb-2">Xác nhận</h3>
          <p class="text-gray-300 text-[14px] mb-6 leading-relaxed">{{ confirmModal.message }}</p>
          <div class="flex items-center justify-end gap-3 mt-2">
            <button 
              @click="handleConfirm(false)"
              class="px-4 py-2 rounded-xl text-[14px] font-medium text-gray-400 hover:bg-[#2a2f3d] hover:text-white transition"
            >
              Hủy
            </button>
            <button 
              @click="handleConfirm(true)"
              class="px-5 py-2 rounded-xl text-[14px] font-bold bg-[#6366f1] text-white hover:bg-[#4f46e5] transition shadow-md shadow-[#6366f1]/20"
            >
              Đồng ý
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <SongActionMenu
      :show="songMenu.visible"
      :position="songMenu.position"
      :song="songMenu.song"
      :isLiked="songMenu.song ? library.isSongLiked(songMenu.song) : false"
      compact
      @close="closeSongMenu"
      @add-to-playlist="song => library.openPlaylistModal(song)"
      @toggle-like="song => library.toggleSongLike(song)"
      @add-to-queue="addToQueue"
      @go-to-song="openSongDetail"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'
import { messagesApi } from '@/api/messages'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import { useMessagesStore } from '@/stores/messages'
import { usePlayerStore } from '@/stores/player'
import { normalizeImageUrl } from '@/utils/imageUrl'
import LikeButton from '@/components/common/LikeButton.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import { useToastStore } from '@/stores/toast'

const UserAvatar = {
  props: {
    user: { type: Object, required: true },
    sizeClass: { type: String, default: 'h-11 w-11' }
  },
  template: `
    <div
      class="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2a2f3d] text-sm font-bold text-gray-300"
      :class="sizeClass"
    >
      <img v-if="avatarSrc" :src="avatarSrc" alt="" class="h-full w-full object-cover" @error="avatarSrc = ''" />
      <span v-else>{{ initial }}</span>
    </div>
  `,
  data() {
    return { avatarSrc: this.resolveAvatar(this.user.avatar_url) }
  },
  computed: {
    initial() {
      return (this.user.display_name || this.user.name || this.user.username || 'U').charAt(0).toUpperCase()
    },
  },
  watch: {
    'user.avatar_url'(value) {
      this.avatarSrc = this.resolveAvatar(value)
    },
  },
  methods: {
    resolveAvatar(url) {
      if (!url) return ''
      if (url.startsWith('http')) return url
      const baseURL = (api.defaults.baseURL || import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api').replace(/\/api\/?$/, '')
      return `${baseURL}${url.startsWith('/') ? '' : '/'}${url}`
    },
  },
}

const auth = useAuthStore()
const messagesStore = useMessagesStore()
const player = usePlayerStore()
const library = useLibraryStore()
const toast = useToastStore()
const route = useRoute()
const router = useRouter()
const conversations = ref([])
const activeConversation = ref(null)
const messages = ref([])
const searchQuery = ref('')
const searchResults = ref([])
const loadingConversations = ref(false)
const loadingMessages = ref(false)
const searchLoading = ref(false)
const sending = ref(false)
const draft = ref('')
const messageListRef = ref(null)
const messageInput = ref(null)
const replyingMessage = ref(null)
let searchTimer = null

const actionMenu = ref({ visible: false, message: null, x: 0, y: 0 })
const songMenu = ref({ visible: false, position: { x: 0, y: 0 }, song: null })
const allowedEmojis = ['❤️', '🔥', '🎧', '😍', '👏', '🎵']
const confirmModal = ref({ visible: false, message: '', resolve: null })
const peerNowPlaying = ref(null)

function requestConfirm(message) {
  return new Promise((resolve) => {
    confirmModal.value = { visible: true, message, resolve }
  })
}

function handleConfirm(result) {
  if (confirmModal.value.resolve) confirmModal.value.resolve(result)
  confirmModal.value.visible = false
}

const currentUserId = computed(() => auth.user?.id)

function unwrap(response) {
  return response.data?.data || []
}

function displayUserName(user) {
  return user?.display_name || user?.name || user?.username || 'Người dùng MusicFlow'
}

function chatSocket() {
  return messagesStore.socket
}

function setupSocket() {
  if (currentUserId.value) messagesStore.initSocket(currentUserId.value)
  const socket = chatSocket()
  if (!socket) return
  socket.on('connect', handleSocketConnect)
  socket.on('chat:new_message', handleSocketMessage)
  socket.on('chat:message_deleted', handleSocketMessageDeleted)
  socket.on('chat:conversation_updated', handleConversationUpdated)
  socket.on('chat:error', handleSocketError)
  socket.on('user:presence_changed', handleUserStatus)
  socket.on('chat:reaction_updated', handleReactionUpdated)
  socket.on('chat:now_playing:state', handleNowPlayingState)
  socket.on('chat:now_playing:state_updated', handleNowPlayingStateUpdated)
  handleSocketConnect()
}

function cleanupSocket() {
  const socket = chatSocket()
  if (!socket) return
  socket.off('connect', handleSocketConnect)
  socket.off('chat:new_message', handleSocketMessage)
  socket.off('chat:message_deleted', handleSocketMessageDeleted)
  socket.off('chat:conversation_updated', handleConversationUpdated)
  socket.off('chat:error', handleSocketError)
  socket.off('user:presence_changed', handleUserStatus)
  socket.off('chat:reaction_updated', handleReactionUpdated)
  socket.off('chat:now_playing:state', handleNowPlayingState)
  socket.off('chat:now_playing:state_updated', handleNowPlayingStateUpdated)
}

function handleReactionUpdated({ conversationId, messageId, reactions, actorUserId }) {
  if (conversationId && activeConversation.value?.conversation_id !== conversationId) return
  const msg = messages.value.find(m => String(m.id) === String(messageId))
  if (!msg) return

  const isMe = actorUserId === currentUserId.value
  
  if (isMe) {
    msg.reactions = reactions
  } else {
    // Preserve my own reactedByMe state
    const myReactions = msg.reactions || []
    msg.reactions = reactions.map(newReaction => {
      const existing = myReactions.find(r => r.emoji === newReaction.emoji)
      return {
        ...newReaction,
        reactedByMe: existing ? existing.reactedByMe : false
      }
    }).filter(r => r.count > 0)
  }
}

function handleNowPlayingState({ conversationId, users }) {
  if (activeConversation.value?.conversation_id !== conversationId) return
  const peer = users.find(u => Number(u.userId) !== Number(currentUserId.value))
  if (peer && peer.isPlaying) {
    peerNowPlaying.value = peer.song
  } else {
    peerNowPlaying.value = null
  }
}

function handleNowPlayingStateUpdated(data) {
  if (Number(data.conversationId) !== Number(activeConversation.value?.conversation_id)) return
  if (Number(data.userId) === Number(activeConversation.value?.other_user?.id)) {
    if (data.isPlaying) peerNowPlaying.value = data.song
    else peerNowPlaying.value = null
  }
}

watch(activeConversation, (conv) => {
  peerNowPlaying.value = null
  if (conv) {
    chatSocket()?.emit('chat:now_playing:get', { conversationId: conv.conversation_id })
  }
}, { immediate: true })

watch(
  [() => player.currentSong?.id, () => player.isPlaying],
  ([songId, isPlaying]) => {
    if (songId) {
      chatSocket()?.emit('chat:now_playing:update', {
        song: {
          id: player.currentSong.id,
          title: player.currentSong.title,
          artist_name: player.currentSong.artist_name || player.currentSong.artist,
          cover_url: player.currentSong.cover_url || player.currentSong.cover,
          duration: player.currentSong.duration_sec || player.currentSong.duration
        },
        isPlaying,
        position: player.currentTime || 0
      })
    }
  }
)

// ================= ACTION MENU LOGIC =================

function openActionMenu(message, event) {
  if (!message || message.message_type === 'recalled' || message.status) return
  
  let clientX = event.clientX
  let clientY = event.clientY
  
  if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX
    clientY = event.touches[0].clientY
  }

  const menuWidth = 224 // w-56 is 224px
  const menuHeight = 160 // approx
  let x = clientX
  let y = clientY
  
  // Adjust for screen boundaries
  if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 16
  if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 16
  if (x < 16) x = 16
  if (y < 16) y = 16

  actionMenu.value = {
    visible: true,
    message,
    x,
    y
  }
}

function closeActionMenu() {
  actionMenu.value.visible = false
  actionMenu.value.message = null
}

function handleActionReply(message) {
  if (!message) return
  replyingMessage.value = message
  draft.value = ''
  nextTick(() => {
    messageInput.value?.focus()
  })
  closeActionMenu()
}

function handleActionEmoji(emoji) {
  if (!actionMenu.value.message) return
  toggleReaction(actionMenu.value.message.id, emoji)
  closeActionMenu()
}

function handleActionRecall(message) {
  if (!message) return
  recallMessage(message)
  closeActionMenu()
}

// ================= MESSAGE LOGIC =================

function handleUserStatus({ userId, online, lastSeenAt }) {
  const item = conversations.value.find(c => c.other_user?.id === userId)
  if (item && item.other_user) {
    item.other_user.online = online
    if (lastSeenAt) {
      item.other_user.last_seen_at = lastSeenAt
    }
  }
}

async function toggleReaction(messageId, emoji) {
  closeActionMenu()
  try {
    const res = await messagesApi.toggleReaction(messageId, emoji)
    if (res.data?.data?.reactions) {
      const msg = messages.value.find(m => m.id === messageId)
      if (msg) msg.reactions = res.data.data.reactions
    }
  } catch (err) {
    console.error('Failed to toggle reaction', err)
  }
}

function handleSocketMessageDeleted({ messageId }) {
  const msg = messages.value.find((m) => m.id === messageId)
  if (msg) {
    msg.body = 'Tin nhắn đã được thu hồi'
    msg.message_type = 'recalled'
    msg.shared_song = null
    msg.shared_song_id = null
    msg.reactions = []
  }
}

function handleSocketConnect() {
  if (currentUserId.value) chatSocket()?.emit('join', { userId: currentUserId.value })
  if (activeConversation.value) {
    chatSocket()?.emit('chat:join', { conversationId: activeConversation.value.conversation_id })
  }
}

function handleSocketMessage(message) {
  if (activeConversation.value?.conversation_id !== message.conversation_id) return
  if (messages.value.some((item) => item.id === message.id)) return
  messages.value.push(message)
  scrollToBottom()
  markActiveRead()
}

function handleConversationUpdated(conversation) {
  upsertConversation(conversation)
  if (typeof conversation?.totalUnreadCount === 'number') {
    messagesStore.setUnreadCount(conversation.totalUnreadCount)
  } else {
    messagesStore.refreshUnreadCount()
  }
}

function handleSocketError(payload) {
  console.error('Chat error:', payload?.message || payload)
}

function upsertConversation(conversation) {
  if (!conversation?.conversation_id) return
  const index = conversations.value.findIndex((item) => item.conversation_id === conversation.conversation_id)
  if (index >= 0) {
    const existing = conversations.value[index]
    if (existing.other_user && conversation.other_user && conversation.other_user.online === undefined) {
      conversation.other_user.online = existing.other_user.online
      conversation.other_user.last_seen_at = existing.other_user.last_seen_at
    }
    conversations.value.splice(index, 1, conversation)
  } else {
    conversations.value.unshift(conversation)
  }
  conversations.value.sort((a, b) => new Date(b.last_message?.created_at || b.updated_at) - new Date(a.last_message?.created_at || a.updated_at))

  if (activeConversation.value?.conversation_id === conversation.conversation_id) {
    activeConversation.value = { ...activeConversation.value, ...conversation, unread_count: 0 }
  }
}

function conversationPreview(conversation) {
  const message = conversation.last_message
  if (!message) return 'Bắt đầu trò chuyện'
  if (message.message_type === 'song_share') {
    return `Đã chia sẻ: ${message.shared_song?.title || 'một bài hát'}`
  }
  return message.body || 'Tin nhắn'
}

async function loadConversations() {
  loadingConversations.value = true
  try {
    conversations.value = unwrap(await messagesApi.getConversations())
  } finally {
    loadingConversations.value = false
  }
}

async function selectConversationFromQuery() {
  const conversationId = Number(route.query.conversationId)
  if (!Number.isInteger(conversationId) || conversationId <= 0) return
  const conversation = conversations.value.find((item) => Number(item.conversation_id) === conversationId)
  if (conversation) await selectConversation(conversation)
}

async function selectConversation(conversation) {
  if (activeConversation.value) {
    chatSocket()?.emit('chat:leave', { conversationId: activeConversation.value.conversation_id })
  }
  activeConversation.value = conversation
  replyingMessage.value = null
  chatSocket()?.emit('chat:join', { conversationId: conversation.conversation_id })
  await loadMessages(conversation.conversation_id)
  await markActiveRead()
}

async function loadMessages(conversationId) {
  loadingMessages.value = true
  try {
    messages.value = unwrap(await messagesApi.getMessages(conversationId, { limit: 50 }))
    scrollToBottom()
  } finally {
    loadingMessages.value = false
  }
}

async function openDirectConversation(user) {
  const conversation = unwrap(await messagesApi.createDirectConversation(user.id))
  searchQuery.value = ''
  searchResults.value = []
  upsertConversation(conversation)
  await selectConversation(conversation)
}

function openUserProfile(userId) {
  if (!userId) return
  router.push(`/users/${userId}`)
}

function songCover(song) {
  return normalizeImageUrl(song?.cover_url || '')
}

function songArtist(song) {
  return song?.artist || song?.artist_name || 'Nghệ sĩ'
}

function songShareDescription(song) {
  const title = song?.title || 'Bài hát'
  return `Đã chia sẻ: ${title} · ${songArtist(song)}`
}

function isDefaultShareBody(message) {
  if (!message?.shared_song) return false
  return message.body === `Đã chia sẻ: ${message.shared_song.title}`
}

function openSongDetail(song) {
  if (!song?.id) return
  router.push(`/song/${song.id}`)
}

function playSharedSong(song) {
  if (!song) return
  player.setSong({
    ...song,
    artist_name: song.artist_name || song.artist,
  }, [], 'chat')
}

function addToQueue(song) {
  if (!song) return
  player.addToQueue(song)
  toast.showToast('Đã thêm vào hàng chờ', 'success')
}

function openSongMenu(song, event) {
  songMenu.value = {
    visible: true,
    position: { x: event.clientX, y: event.clientY },
    song
  }
}

function closeSongMenu() {
  songMenu.value.visible = false
}

function isOwnMessage(message) {
  return Number(message.sender_id) === Number(currentUserId.value)
}

const groupedMessages = computed(() => {
  const groups = []
  let currentGroup = null

  messages.value.forEach((msg) => {
    if (!currentGroup) {
      currentGroup = {
        sender_id: msg.sender_id,
        isOwn: isOwnMessage(msg),
        messages: [msg],
        start_time: msg.created_at,
        end_time: msg.created_at
      }
      groups.push(currentGroup)
    } else {
      const msgTime = new Date(msg.created_at).getTime()
      const endTime = new Date(currentGroup.end_time).getTime()
      const diffMs = msgTime - endTime
      
      if (msg.sender_id === currentGroup.sender_id && diffMs <= 120000) {
        currentGroup.messages.push(msg)
        currentGroup.end_time = msg.created_at
      } else {
        currentGroup = {
          sender_id: msg.sender_id,
          isOwn: isOwnMessage(msg),
          messages: [msg],
          start_time: msg.created_at,
          end_time: msg.created_at
        }
        groups.push(currentGroup)
      }
    }
  })
  
  return groups
})

function showDateDividerForGroup(index) {
  if (index === 0) return true
  const current = new Date(groupedMessages.value[index].start_time).toDateString()
  const previous = new Date(groupedMessages.value[index - 1].start_time).toDateString()
  return current !== previous
}

function getBubbleShape(isOwn, length, index) {
  if (length === 1) return isOwn ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
  const isFirst = index === 0
  if (isOwn) {
    if (isFirst) return 'rounded-2xl rounded-br-sm'
    return 'rounded-2xl rounded-tr-sm rounded-br-sm'
  } else {
    if (isFirst) return 'rounded-2xl rounded-bl-sm'
    return 'rounded-2xl rounded-tl-sm rounded-bl-sm'
  }
}

function isGroupRead(group) {
  if (!group.messages.length) return false
  const lastMsg = group.messages[group.messages.length - 1]
  if (typeof lastMsg.id !== 'number') return false
  return lastMsg.id <= (activeConversation.value?.other_last_read_message_id || 0)
}

async function recallMessage(message) {
  const confirmed = await requestConfirm('Bạn có chắc chắn muốn thu hồi tin nhắn này?')
  if (!confirmed) return
  try {
    await messagesApi.deleteMessage(activeConversation.value.conversation_id, message.id)
    message.body = 'Tin nhắn đã được thu hồi'
    message.message_type = 'recalled'
    message.shared_song = null
    message.shared_song_id = null
    message.reactions = []
  } catch (err) {
    alert(err.message || 'Không thể thu hồi tin nhắn')
  }
}

function retryMessage(msg) {
  if (msg.status !== 'error') return
  msg.status = 'sending'
  const tempId = msg.id
  
  const socket = chatSocket()
  if (socket?.connected) {
    socket.emit('chat:send_message', {
      conversationId: msg.conversation_id,
      body: msg.body,
      replyToMessageId: msg.reply_to?.id || msg.reply_to_message_id
    }, (response) => {
       if (response && response.success) {
          const tempIdx = messages.value.findIndex(m => m.id === tempId)
          const realIdx = messages.value.findIndex(m => m.id === response.message.id)
          if (realIdx !== -1 && tempIdx !== -1 && realIdx !== tempIdx) {
            messages.value.splice(tempIdx, 1)
          } else if (tempIdx !== -1) {
            messages.value[tempIdx] = response.message
          }
       } else {
          msg.status = 'error'
          msg.error_message = response?.error || 'Lỗi gửi tin nhắn'
       }
    })
  } else {
    messagesApi.sendMessage(msg.conversation_id, msg.body)
      .then(res => {
        const message = unwrap(res)
        const tempIdx = messages.value.findIndex(m => m.id === tempId)
        const realIdx = messages.value.findIndex(m => m.id === message.id)
        if (realIdx !== -1 && tempIdx !== -1 && realIdx !== tempIdx) {
          messages.value.splice(tempIdx, 1)
        } else if (tempIdx !== -1) {
          messages.value[tempIdx] = message
        }
      })
      .catch((err) => {
        msg.status = 'error'
        msg.error_message = err.message || 'Lỗi mạng'
      })
  }
}

async function sendMessage() {
  const body = draft.value.trim()
  if (!body || !activeConversation.value || sending.value) return

  sending.value = true
  draft.value = ''
  
  const tempId = 'temp_' + Date.now()
  const currentReply = replyingMessage.value
  replyingMessage.value = null
  
  const optimisticMsg = {
    id: tempId,
    conversation_id: activeConversation.value.conversation_id,
    sender_id: currentUserId.value,
    body,
    message_type: 'text',
    created_at: new Date().toISOString(),
    status: 'sending'
  }
  
  if (currentReply) {
    optimisticMsg.reply_to_message_id = currentReply.id
    optimisticMsg.reply_to = {
      id: currentReply.id,
      sender_name: currentReply.sender?.display_name || currentReply.sender_name || 'Người dùng',
      body: currentReply.body,
      message_type: currentReply.message_type,
      shared_song: currentReply.shared_song
    }
  }
  
  messages.value.push(optimisticMsg)
  scrollToBottom()
  
  try {
    const socket = chatSocket()
    if (socket?.connected) {
      socket.emit('chat:send_message', {
        conversationId: activeConversation.value.conversation_id,
        body,
        replyToMessageId: currentReply ? currentReply.id : undefined
      }, (response) => {
         if (response && response.success) {
            const tempIdx = messages.value.findIndex(m => m.id === tempId)
            const realIdx = messages.value.findIndex(m => m.id === response.message.id)
            if (realIdx !== -1 && tempIdx !== -1 && realIdx !== tempIdx) {
              messages.value.splice(tempIdx, 1)
            } else if (tempIdx !== -1) {
              messages.value[tempIdx] = response.message
            }
         } else {
            const idx = messages.value.findIndex(m => m.id === tempId)
            if (idx !== -1) {
              messages.value[idx].status = 'error'
              messages.value[idx].error_message = response?.error || 'Lỗi gửi tin nhắn'
            }
         }
      })
    } else {
      const message = unwrap(await messagesApi.sendMessage(
        activeConversation.value.conversation_id, 
        body, 
        currentReply ? currentReply.id : undefined
      ))
      const tempIdx = messages.value.findIndex(m => m.id === tempId)
      const realIdx = messages.value.findIndex(m => m.id === message.id)
      if (realIdx !== -1 && tempIdx !== -1 && realIdx !== tempIdx) {
        messages.value.splice(tempIdx, 1)
      } else if (tempIdx !== -1) {
        messages.value[tempIdx] = message
      }
      await loadConversations()
    }
  } catch(err) {
      const idx = messages.value.findIndex(m => m.id === tempId)
      if (idx !== -1) {
        messages.value[idx].status = 'error'
        messages.value[idx].error_message = err.message || 'Lỗi mạng'
      }
  } finally {
    sending.value = false
  }
}

async function shareCurrentSong() {
  if (!player.currentSong || !activeConversation.value || sending.value) return
  
  sending.value = true
  const tempId = 'temp_' + Date.now()
  const payload = {
    conversationId: activeConversation.value.conversation_id,
    body: `Đã chia sẻ: ${player.currentSong.title}`,
    shared_song_id: player.currentSong.id
  }

  const tempMessage = {
    id: tempId,
    conversation_id: payload.conversationId,
    sender_id: currentUserId.value,
    message_type: 'song_share',
    body: payload.body,
    shared_song_id: payload.shared_song_id,
    shared_song: player.currentSong,
    created_at: new Date().toISOString(),
    status: 'sending'
  }
  
  messages.value.push(tempMessage)
  scrollToBottom()

  try {
    const res = await messagesApi.shareSongToConversation(payload.conversationId, payload.shared_song_id, payload.body)
    const message = unwrap(res)
    
    const tempIdx = messages.value.findIndex(m => m.id === tempId)
    const realIdx = messages.value.findIndex(m => m.id === message.id)
    
    if (realIdx !== -1 && tempIdx !== -1 && realIdx !== tempIdx) {
      messages.value.splice(tempIdx, 1)
    } else if (tempIdx !== -1) {
      messages.value[tempIdx] = message
    }
    await loadConversations()
  } catch (err) {
    const idx = messages.value.findIndex(m => m.id === tempId)
    if (idx !== -1) {
      messages.value[idx].status = 'error'
      messages.value[idx].error_message = err.message || 'Lỗi mạng'
    }
  } finally {
    sending.value = false
  }
}

async function markActiveRead() {
  if (!activeConversation.value) return
  try {
    await messagesApi.markRead(activeConversation.value.conversation_id)
    chatSocket()?.emit('chat:mark_read', { conversationId: activeConversation.value.conversation_id })
    const item = conversations.value.find((conversation) => conversation.conversation_id === activeConversation.value.conversation_id)
    if (item) item.unread_count = 0
    await messagesStore.refreshUnreadCount()
  } catch (err) {
    console.error('Cannot mark chat as read:', err)
  }
}

function scrollToBottom() {
  nextTick(() => {
    const el = messageListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function scrollToMessage(msgId) {
  if (!msgId) return
  const el = document.getElementById(`msg-${msgId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('bg-[#6366f1]/30')
    setTimeout(() => {
      el.classList.remove('bg-[#6366f1]/30')
    }, 1500)
  }
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatConversationTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua'
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

function formatDateDivider(value) {
  if (!value) return ''
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'Hôm nay'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua'
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return null
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

watch(searchQuery, (value) => {
  clearTimeout(searchTimer)
  const q = value.trim()
  if (!q) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      searchResults.value = unwrap(await messagesApi.searchUsers(q))
    } finally {
      searchLoading.value = false
    }
  }, 250)
})

watch(() => route.query.conversationId, async () => {
  if (route.name !== 'Messages') return
  await selectConversationFromQuery()
})

onMounted(async () => {
  if (!auth.user) await auth.fetchMe()
  setupSocket()
  await loadConversations()
  await selectConversationFromQuery()
})

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  if (activeConversation.value) {
    chatSocket()?.emit('chat:leave', { conversationId: activeConversation.value.conversation_id })
  }
  cleanupSocket()
})
</script>

<style scoped>
.messages-shell {
  height: calc(100dvh - 160px);
}
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: #2a2f3d transparent;
}
.scrollbar-thin::-webkit-scrollbar {
  width: 5px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #2a2f3d;
  border-radius: 999px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #4b5563;
}
.overflow-wrap-anywhere {
  overflow-wrap: anywhere;
}
</style>
