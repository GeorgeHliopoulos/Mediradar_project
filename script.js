// GDPR Modal
function showGdpr() {
  fetch('gdpr_terms.txt')
    .then(response => response.text())
    .then(text => {
      document.getElementById('gdpr-text').textContent = text;
      document.getElementById('gdpr-modal').style.display = 'block';
    });
}

function hideGdpr() {
  document.getElementById('gdpr-modal').style.display = 'none';
}

// Dropdown toggle for profile icon
const profileIcon = document.getElementById('profile-icon');
const userMenu = document.getElementById('user-menu');

profileIcon.addEventListener('click', () => {
  userMenu.style.display = userMenu.style.display === 'flex' ? 'none' : 'flex';
});

// Close dropdown if clicked outside
document.addEventListener('click', (event) => {
  if (!profileIcon.contains(event.target) && !userMenu.contains(event.target)) {
    userMenu.style.display = 'none';
  }
});

// Form submission confirmation
document.getElementById('medicine-form').addEventListener('submit', (e) => {
  e.preventDefault();
  alert('Η αίτηση υποβλήθηκε με επιτυχία!');
  e.target.reset();
});
