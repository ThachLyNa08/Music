const fs = require('fs');
const path = require('path');

const files = [
    'src/views/admin/AdminAlbumsView.vue',
    'src/views/admin/AdminPremiumView.vue',
    'src/views/admin/AdminStemJobsView.vue',
    'src/views/admin/AdminSystemPlaylistsView.vue',
    'src/views/admin/ManageArtists.vue',
    'src/views/admin/ManageGenres.vue',
    'src/views/admin/ManageSongs.vue',
    'src/views/admin/ManageTransactions.vue',
    'src/views/admin/ManageUsers.vue',
    'src/views/admin/MusicDataToolsView.vue'
];

let count = 0;
const importPattern = /import\s+AdminFilterBar\s+from\s+['"].*AdminFilterBar\.vue['"];?\n?/g;
const openTagPattern = /<AdminFilterBar[^>]*>/g;

files.forEach(f => {
    const fullPath = path.join(__dirname, f);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        let newContent = content.replace(openTagPattern, '<div class="mb-6">');
        newContent = newContent.replace(/<\/AdminFilterBar>/g, '</div>');
        newContent = newContent.replace(importPattern, '');
        
        if (newContent !== content) {
            fs.writeFileSync(fullPath, newContent, 'utf-8');
            count++;
            console.log('Updated ' + f);
        }
    }
});

console.log('Total files updated: ' + count);
