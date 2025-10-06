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
