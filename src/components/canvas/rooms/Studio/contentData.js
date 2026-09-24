/**
 * Studio content: each item is shown on a monitor in the tower.
 * Platform keys select the device shape: youtube = wide TV, blog = monitor, tiktok = phone.
 * Here they are re-used for Projects / Skills / Links.
 */
const ACCENT = { color: '#8B5CF6', accentColor: '#6D3FD6' };
export const PLATFORM_CONFIG = {
    youtube: { ...ACCENT, icon: '▶', label: 'Project', shape: 'tv' },
    blog: { ...ACCENT, icon: '🛠', label: 'Skills', shape: 'monitor' },
    tiktok: { ...ACCENT, icon: '🔗', label: 'Link', shape: 'phone' },
};

const RAW_CONTENT_DATA = [
    { id: 'proj-001', platform: 'youtube', title: 'E-Commerce App', description: 'An online store with product browsing, cart management, and a smooth shopping experience.', thumbnail: null, url: 'https://github.com/Nat-bit-ai', date: '2026-03-03' },
    { id: 'proj-002', platform: 'youtube', title: 'National Voting System', description: 'A secure digital voting platform built for nationwide elections and easy voter access.', thumbnail: null, url: 'https://github.com/Nat-bit-ai', date: '2026-03-02' },
    { id: 'proj-003', platform: 'youtube', title: 'Portfolio Website', description: 'This portfolio: design approach, visual UI, and project storytelling.', thumbnail: null, url: 'https://github.com/Nat-bit-ai', date: '2026-03-01' },
    { id: 'skill-001', platform: 'blog', title: 'Frontend', description: 'HTML, CSS, JavaScript, React and Tailwind CSS.', thumbnail: null, url: 'https://github.com/Nat-bit-ai', date: '2026-02-03' },
    { id: 'skill-002', platform: 'blog', title: 'Backend and Data', description: 'Python, PHP and MySQL.', thumbnail: null, url: 'https://github.com/Nat-bit-ai', date: '2026-02-02' },
    { id: 'skill-003', platform: 'blog', title: 'Languages and Tools', description: 'C++, Java, Git and GitHub.', thumbnail: null, url: 'https://github.com/Nat-bit-ai', date: '2026-02-01' },
    { id: 'link-001', platform: 'tiktok', title: 'GitHub', description: 'github.com/Nat-bit-ai', thumbnail: null, url: 'https://github.com/Nat-bit-ai', date: '2026-01-02' },
    { id: 'link-002', platform: 'tiktok', title: 'Email me', description: 'nathyzer21@gmail.com', thumbnail: null, url: 'mailto:nathyzer21@gmail.com', date: '2026-01-01' },
];

const ytTextures = ['/textures/studio/tvfront_filmikprojektdlamultiego.webp', '/textures/studio/tvfront_filmikedytowaniezdjec.webp'];
const ytPaintedTextures = ['/textures/studio/tvfront_filmikprojektdlamultiego_painted.webp', '/textures/studio/tvfront_filmikedytowaniezdjec_painted.webp'];
const blogTextures = ['/textures/studio/monitorfront_postnafbdoublewinner.webp'];
const blogPaintedTextures = ['/textures/studio/monitorfront_postnafbdoublewinner_painted.webp'];
const ttTextures = ['/textures/studio/phonefront_followmeontiktok.webp'];
const ttPaintedTextures = ['/textures/studio/phonefront_followmeontiktok_painted.webp'];

let ytIdx = 0, blogIdx = 0, ttIdx = 0;
let ytPIdx = 0, blogPIdx = 0, ttPIdx = 0;

export const CONTENT_DATA = RAW_CONTENT_DATA.map((item) => {
    return {
        ...item,
        frontTexture: item.frontTexture || (
            item.platform === 'youtube' ? ytTextures[ytIdx++ % ytTextures.length] :
                item.platform === 'blog' ? blogTextures[blogIdx++ % blogTextures.length] :
                    ttTextures[ttIdx++ % ttTextures.length]
        ),
        paintedFrontTexture: item.paintedFrontTexture || (
            item.platform === 'youtube' ? ytPaintedTextures[ytPIdx++ % ytPaintedTextures.length] :
                item.platform === 'blog' ? blogPaintedTextures[blogPIdx++ % blogPaintedTextures.length] :
                    ttPaintedTextures[ttPIdx++ % ttPaintedTextures.length]
        )
    };
});

// Helper to get content by platform
export const getContentByPlatform = (platform) => {
    if (platform === 'all') return CONTENT_DATA;
    return CONTENT_DATA.filter(item => item.platform === platform);
};

// Get latest content (for "On Air" indicator)
export const getLatestContent = () => {
    return [...CONTENT_DATA].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
};
