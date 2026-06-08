/* ===== TAURUS MEDICAL — DOCTORS PHOTO ENHANCER =====
 * Enhances static doctor cards on vrachi.html by loading photos from the API.
 * Finds doctor cards with links to vrachi/{id}.html and updates avatars with photo_url.
 * Usage: <script src="js/doctors-photo-enhancer.js"></script> (on vrachi.html)
 */
document.addEventListener('DOMContentLoaded', async function() {
    const grid = document.getElementById('doctorsGrid');
    if (!grid) return;

    try {
        const resp = await fetch('tables/doctors?limit=100');
        const data = await resp.json();
        const doctors = data.data || [];

        // Build a map: doctor id -> doctor data
        const doctorMap = {};
        doctors.forEach(d => {
            if (d.id) doctorMap[d.id] = d;
        });

        // Find all doctor cards and enhance with photos
        const cards = grid.querySelectorAll('.doctor-card');
        cards.forEach(card => {
            const nameLink = card.querySelector('.doctor-card__name a');
            if (!nameLink) return;

            const href = nameLink.getAttribute('href') || '';
            // Extract doctor id from href like "vrachi/inbar.html"
            const match = href.match(/vrachi\/([^.]+)\.html/);
            if (!match) return;

            const doctorId = match[1];
            const doctor = doctorMap[doctorId];
            if (!doctor) return;

            // Update avatar with photo
            const avatar = card.querySelector('.doctor-card__avatar');
            if (avatar && doctor.photo_url) {
                avatar.innerHTML = `<img src="${doctor.photo_url}" alt="${doctor.name_ru}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user-doctor\\'></i>'">`;
            }
        });
    } catch (e) {
        // Silently fail — static content remains intact
        console.log('Photo enhancer: could not load doctor data');
    }
});
