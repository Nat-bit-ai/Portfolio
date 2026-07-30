document.getElementById('my-form').addEventListener('submit', function(event) {
  event.preventDefault();
  const name = document.getElementById('name').value;
  alert(`Thank you, ${name}! Your form has been submitted.`);
  this.reset();
});
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    const carousel = document.getElementById('projectCarousel');
    const prevBtn = document.querySelector('.project-nav.prev');
    const nextBtn = document.querySelector('.project-nav.next');

      menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
      });

    const cards = document.querySelectorAll(".project-card");

let activeIndex = 0;

function showCard(index) {
    for (let i = 0; i < cards.length; i++) {
        cards[i].classList.remove("active");
    }

    cards[index].classList.add("active");

    carousel.scrollLeft = index * 384; 
}

prevBtn.addEventListener("click", function () {
    if (activeIndex > 0) {
        activeIndex--;
        showCard(activeIndex);
    }
});

nextBtn.addEventListener("click", function () {
    if (activeIndex < cards.length - 1) {
        activeIndex++;
        showCard(activeIndex);
    }
});
