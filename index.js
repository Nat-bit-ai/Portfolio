const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const carousel = document.getElementById('projectCarousel');
const prevBtn = document.querySelector('.project-nav.prev');
const nextBtn = document.querySelector('.project-nav.next');
const contactForm = document.getElementById('my-form');
const profileName = document.getElementById('profile-name');
const profileTitle = document.getElementById('profile-title');
const profileDescription = document.getElementById('profile-description');
const contactEmail = document.getElementById('contact-email');
const contactPhone = document.getElementById('contact-phone');
const contactLocation = document.getElementById('contact-location');
const cvDownloadLink = document.getElementById('cv-download-link');
const homeHeroImage = document.getElementById('home-hero-image');
const techStackGrid = document.getElementById('tech-stack-grid');

async function loadHomepageSettings() {
  try {
    const response = await fetch('/api/homepage');
    if (!response.ok) throw new Error('Failed to load homepage settings');
    const homepage = await response.json();

    if (homeHeroImage) {
      homeHeroImage.src = homepage.heroImage || 'images/photo_2026-02-26_07-03-17.jpg';
    }

    const stacks = Array.isArray(homepage.techStacks) && homepage.techStacks.length
      ? homepage.techStacks
      : [
          { name: 'HTML', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg' },
          { name: 'CSS', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/css3/css3-original.svg' },
          { name: 'JavaScript', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg' },
          { name: 'React', image: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg' }
        ];

    if (techStackGrid) {
      techStackGrid.innerHTML = stacks.map((stack) => `
        <div class="skill-chip" title="${stack.name || 'Skill'}" aria-label="${stack.name || 'Skill'}">
          <span class="tech-icon">
            <img src="${stack.image || 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg'}" width="40" height="40" alt="${stack.name || 'Skill'} icon" aria-hidden="true" />
          </span>
          <span class="sr-only">${stack.name || 'Skill'}</span>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Homepage settings load error:', error);
  }
}

async function loadProfile() {
  try {
    const response = await fetch('/api/profile');
    if (!response.ok) throw new Error('Failed to load profile');
    const profile = await response.json();

    if (profileName) profileName.textContent = profile.name || 'Natnael Zerihun';
    if (profileTitle) profileTitle.textContent = profile.title || 'Frontend Developer';
    if (profileDescription) profileDescription.textContent = profile.description || '';
    if (contactEmail) contactEmail.textContent = profile.email || 'nathyzer21@gmail.com';
    if (contactPhone) contactPhone.textContent = profile.phone || '+251 967 323 308';
    if (contactLocation) contactLocation.textContent = profile.location || 'Addis Ababa, Ethiopia';
    if (cvDownloadLink && profile.cv?.url) {
      cvDownloadLink.href = profile.cv.url;
      cvDownloadLink.setAttribute('download', profile.cv.fileName || 'cv.pdf');
    }
  } catch (error) {
    console.error('Profile load error:', error);
  }
}

async function loadProjects() {
  try {
    const response = await fetch('/api/projects');
    if (!response.ok) throw new Error('Failed to load projects');
    const projects = await response.json();

    if (!carousel) return;

    carousel.innerHTML = projects.map((project, index) => `
      <article class="project-card ${index === 0 ? 'active' : ''}" data-index="${index}">
        <div class="project-code-label"><span>&lt;</span>projects<span>&gt;</span><span class="project-code-icon">›</span></div>
        <img src="${project.image || 'images/default-project.jpg'}" alt="${project.title}" />
        <div class="project-info">
          <span class="project-tag">${project.tag || 'Project'}</span>
          <h3>${project.title}</h3>
          <p>${project.description}</p>
          <a href="${project.link || '#projects'}" class="project-link">View project</a>
        </div>
      </article>
    `).join('');

    const cards = Array.from(document.querySelectorAll('.project-card'));
    let activeIndex = 0;

    function showCard(index) {
      if (!cards.length) return;

      activeIndex = Math.max(0, Math.min(index, cards.length - 1));
      cards.forEach((card) => card.classList.remove('active'));
      cards[activeIndex].classList.add('active');

      const gap = Number.parseFloat(getComputedStyle(carousel).gap || '24');
      const targetLeft = cards[activeIndex].offsetLeft - gap * 0.5;
      carousel.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }

    prevBtn?.addEventListener('click', () => {
      showCard(activeIndex - 1);
    });

    nextBtn?.addEventListener('click', () => {
      showCard(activeIndex + 1);
    });

    showCard(0);
  } catch (error) {
    console.error('Project load error:', error);
  }
}

contactForm?.addEventListener('submit', async function (event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('name').value,
    email: document.querySelector('#my-form input[type="email"]').value,
    message: document.querySelector('#my-form textarea').value
  };

  try {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Could not send message');
    }

    alert(`Thank you, ${payload.name}! Your message has been sent.`);
    this.reset();
  } catch (error) {
    alert(error.message || 'Failed to send message.');
  }
});

menuToggle?.addEventListener('click', () => {
  navLinks?.classList.toggle('active');
});

document.getElementById('admin-link')?.addEventListener('click', (event) => {
  event.preventDefault();
  window.location.href = '/admin';
});

loadProfile();
loadHomepageSettings();
loadProjects();