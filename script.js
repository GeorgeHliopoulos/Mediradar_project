
function loginWith(provider) {
    alert("Login with " + provider + " is not yet implemented.");
}

function showGDPR() {
    document.getElementById("gdpr-modal").style.display = "block";
}

function closeGDPR() {
    document.getElementById("gdpr-modal").style.display = "none";
}

document.getElementById("medicine-form").addEventListener("submit", function(event) {
    event.preventDefault();
    alert("Η αίτηση υποβλήθηκε με επιτυχία!");
});
