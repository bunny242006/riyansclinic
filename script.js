const API_BASE = '/api';

const schedules = {
    "Dr. Mahalakshmi Peruri": {
        intervals: [["10:00", "13:30"], ["18:00", "21:00"]],
        display: "10:00 AM - 01:30 PM & 06:00 PM - 09:00 PM"
    },
    
};

let blockedDatesConfig = [];

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    // Initialize authentication, splash screen transitions, and gate access
    initAuth();

    // Set date input to tomorrow's date by default (prevents booking in the past)
    const dateInput = document.getElementById("date");
    if (dateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const yyyy = tomorrow.getFullYear();
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const dd = String(tomorrow.getDate()).padStart(2, '0');
        dateInput.min = `${yyyy}-${mm}-${dd}`;
        dateInput.value = `${yyyy}-${mm}-${dd}`;
    }

    // Set initial doctor hours display
    updateSelectedDoctorHours();

    // Load and render patient appointments
    renderBookings();

    // Setup Theme Mode
    initTheme();

    // Mobile Hamburger Menu Setup
    initMobileMenu();

    // Setup Navigation Highlighting on Scroll
    initScrollspy();
    
    // Fetch blocked dates for validation
    fetchBlockedDates();

    // Load available video slots
    fetchVideoSlots();

    // Load patient video bookings
    renderVideoBookings();
});

async function fetchBlockedDates() {
    try {
        const res = await fetch(`${API_BASE}/blocked-dates`);
        blockedDatesConfig = await res.json();
        setupDateInputValidation();
        updateDoctorAvailability();
    } catch (err) {
        console.error("Failed to load blocked dates", err);
    }
}

// Update doctor availability badge based on today's blocked dates
function updateDoctorAvailability() {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // List of all doctors on the page
    const doctors = ['Dr. Mahalakshmi Peruri'];

    doctors.forEach(doctor => {
        const badge = document.getElementById(`availability-${doctor}`);
        if (!badge) return;

        // Check if today falls within any blocked range for this doctor
        const isBlockedToday = blockedDatesConfig.some(bd =>
            (bd.doctor === doctor || bd.doctor === 'all') &&
            todayStr >= bd.start_date &&
            todayStr <= bd.end_date
        );

        if (isBlockedToday) {
            badge.className = 'available-badge unavailable';
            badge.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Not Available Today';
        } else {
            badge.className = 'available-badge available';
            badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Available Today';
        }
    });
}

// Real-time date input validation against blocked ranges
function setupDateInputValidation() {
    const dateInput = document.getElementById("date");
    const doctorSelect = document.getElementById("doctor");
    if (!dateInput) return;

    function checkIfDateBlocked(date, doctor) {
        for (let bd of blockedDatesConfig) {
            if (bd.doctor === doctor || bd.doctor === 'all') {
                // Block ALL dates between start_date and end_date (inclusive)
                if (date >= bd.start_date && date <= bd.end_date) {
                    return true;
                }
            }
        }
        return false;
    }

    function validateDateInput() {
        const selectedDate = dateInput.value;
        const selectedDoctor = doctorSelect ? doctorSelect.value : '';
        const dateError = document.getElementById("dateBlockedError");

        if (!selectedDate) return;

        if (checkIfDateBlocked(selectedDate, selectedDoctor)) {
            dateInput.style.border = '2px solid #e74c3c';
            if (dateError) {
                dateError.style.display = 'block';
                dateError.textContent = `\u26A0\uFE0F ${selectedDoctor} is unavailable on this date. Please choose a different date.`;
            }
        } else {
            dateInput.style.border = '';
            if (dateError) dateError.style.display = 'none';
        }
    }

    dateInput.addEventListener('change', validateDateInput);
    if (doctorSelect) doctorSelect.addEventListener('change', validateDateInput);
}

// --- NAVIGATION & SCROLL EVENTS ---
function scrollToBooking() {
    const bookingSection = document.getElementById("booking");
    if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: "smooth" });
    }
}

// Triggers when clicking "Book Slot" directly on a Doctor Card
function bookDoctor(doctorName) {
    const doctorDropdown = document.getElementById("doctor");
    if (doctorDropdown) {
        // Search through select values
        for (let option of doctorDropdown.options) {
            if (option.value === doctorName) {
                doctorDropdown.value = doctorName;
                break;
            }
        }
        updateSelectedDoctorHours();
    }
    scrollToBooking();
}

function updateSelectedDoctorHours() {
    const doctorVal = document.getElementById("doctor").value;
    const infoText = document.getElementById("doctorHoursInfo");
    
    if (schedules[doctorVal]) {
        infoText.textContent = `Office Hours: ${schedules[doctorVal].display}`;
    }
}

// --- LIGHT/DARK THEME TOGGLE ---
function initTheme() {
    const themeToggle = document.getElementById("themeToggle");
    const currentTheme = localStorage.getItem("theme") || "light";

    if (currentTheme === "dark") {
        document.documentElement.setAttribute("data-theme", "dark");
        themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
        document.documentElement.setAttribute("data-theme", "light");
        themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }

    themeToggle.addEventListener("click", () => {
        const activeTheme = document.documentElement.getAttribute("data-theme");
        if (activeTheme === "dark") {
            document.documentElement.setAttribute("data-theme", "light");
            themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
            localStorage.setItem("theme", "light");
        } else {
            document.documentElement.setAttribute("data-theme", "dark");
            themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
            localStorage.setItem("theme", "dark");
        }
    });
}

// --- MOBILE MENU ---
function initMobileMenu() {
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("navMenu");
    const navLinks = document.querySelectorAll(".nav-link");

    hamburger.addEventListener("click", () => {
        navMenu.classList.toggle("active");
        const isOpened = navMenu.classList.contains("active");
        hamburger.innerHTML = isOpened ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });

    // Close mobile menu when a nav link is clicked
    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            navMenu.classList.remove("active");
            hamburger.innerHTML = '<i class="fa-solid fa-bars"></i>';
        });
    });
}

// --- SCROLLSPY (Active Navigation Links) ---
function initScrollspy() {
    const sections = document.querySelectorAll("section[id]");
    const navLinks = document.querySelectorAll(".nav-link");

    window.addEventListener("scroll", () => {
        let scrollY = window.pageYOffset;

        sections.forEach(current => {
            const sectionHeight = current.offsetHeight;
            const sectionTop = current.offsetTop - 120; // adjust offset for sticky nav
            const sectionId = current.getAttribute("id");

            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove("active");
                    if (link.getAttribute("href") === `#${sectionId}`) {
                        link.classList.add("active");
                    }
                });
            }
        });
    });
}

// --- APPOINTMENT BOOKING PROCESS ---
async function bookAppointment(e) {
    e.preventDefault();

    const patientName = document.getElementById("name").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const age = document.getElementById("age").value;
    const doctor = document.getElementById("doctor").value;
    const date = document.getElementById("date").value;
    const time = document.getElementById("time").value;
    const symptoms = document.getElementById("symptoms").value.trim();

    // Check doctor availability hours
    const doctorSchedule = schedules[doctor];
    if (!doctorSchedule) {
        showModal("Error", "Selected doctor's schedule was not found.", true);
        return;
    }

    // Check day constraints
    const [year, month, day] = date.split('-').map(Number);
    const bookingDate = new Date(year, month - 1, day);
    const dayOfWeek = bookingDate.getDay();

    if (doctorSchedule.days && !doctorSchedule.days.includes(dayOfWeek)) {
        showModal("Doctor Unavailable", `Sorry, <strong>${doctor}</strong> is only available on: <strong>${doctorSchedule.display}</strong>. Please select a valid date.`, true);
        return;
    }

    // Check Blocked Dates Config (blocks all dates between start_date and end_date inclusive)
    let isBlocked = false;
    for (let bd of blockedDatesConfig) {
        if (bd.doctor === doctor || bd.doctor === 'all') {
            if (date >= bd.start_date && date <= bd.end_date) {
                isBlocked = true;
                break;
            }
        }
    }
    
    if (isBlocked) {
        showModal("Doctor Unavailable", `Sorry, <strong>${doctor}</strong> is on leave or unavailable on the selected date. Please select a different date.`, true);
        return;
    }

    // Check time interval availability
    const intervals = doctorSchedule.intervals;
    let isAvailable = false;
    for (let interval of intervals) {
        if (time >= interval[0] && time <= interval[1]) {
            isAvailable = true;
            break;
        }
    }

    if (!isAvailable) {
        showModal("Doctor Unavailable", `Sorry, <strong>${doctor}</strong> is only available during: <strong>${doctorSchedule.display}</strong>. Please select another time.`, true);
        return;
    }

    const user_email = localStorage.getItem("dp_user_email");
    if (!user_email) {
        openEmailAuth();
        return;
    }

    const payload = { user_email, patient_name: patientName, phone, age, doctor, date, time, symptoms };

    try {
        const res = await fetch(`${API_BASE}/book`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (res.ok) {
            showModal("Appointment Confirmed!", `<p>Your appointment has been successfully booked.</p><p class="modal-token-highlight">Token: <strong>${data.token}</strong></p><p>You can check the status in your dashboard below.</p>`, false);
            document.getElementById("appointmentForm").reset();
            updateSelectedDoctorHours();
            renderBookings();
        } else {
            showModal("Error", data.error || "Failed to book appointment", true);
        }
    } catch (err) {
        console.error(err);
        showModal("Error", "Server connection error", true);
    }
}

// --- API APPOINTMENT MANAGEMENT ---

async function removeBooking(token) {
    const email = localStorage.getItem("dp_user_email");
    if (!confirm('Cancel this appointment?')) return;

    try {
        const res = await fetch(`${API_BASE}/cancel-appointment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, email })
        });
        
        if (res.ok) {
            renderBookings();
            showModal("Appointment Cancelled", `<p>The appointment associated with token <strong>${token}</strong> has been cancelled.</p>`, false);
        }
    } catch (err) {
        console.error(err);
    }
}

async function renderBookings() {
    const noBookingsEl = document.getElementById("noBookings");
    const bookingsListEl = document.getElementById("bookingsList");
    const email = localStorage.getItem("dp_user_email");

    if (!email) {
        noBookingsEl.style.display = "block";
        bookingsListEl.style.display = "none";
        bookingsListEl.innerHTML = "";
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/my-appointments?email=${encodeURIComponent(email)}`);
        const bookings = await res.json();

        if (!bookings || bookings.length === 0) {
            noBookingsEl.style.display = "block";
            bookingsListEl.style.display = "none";
            bookingsListEl.innerHTML = "";
        } else {
            noBookingsEl.style.display = "none";
            bookingsListEl.style.display = "grid";

            bookingsListEl.innerHTML = bookings.map(b => {
                const dateObj = new Date(b.date);
                const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                
                let icon = 'fa-circle-check';
                let colorClass = 'text-accepted';
                if(b.status === 'pending') { icon = 'fa-clock'; colorClass = 'text-pending'; }
                if(b.status === 'rejected' || b.status === 'cancelled') { icon = 'fa-circle-xmark'; colorClass = 'text-rejected'; }

                return `
                    <div class="booking-ticket">
                        <div class="ticket-header">
                            <span class="ticket-token">${b.token}</span>
                            <span class="ticket-status ${colorClass}"><i class="fa-solid ${icon}"></i> ${b.status.toUpperCase()}</span>
                        </div>
                        <div class="ticket-body">
                            <p><span class="label">Patient Name:</span> <span class="val">${escapeHTML(b.patient_name)}</span></p>
                            <p><span class="label">Age:</span> <span class="val">${b.age} Years</span></p>
                            <p><span class="label">Specialist:</span> <span class="val">${b.doctor}</span></p>
                            <p><span class="label">Date:</span> <span class="val">${formattedDate}</span></p>
                            <p><span class="label">Time:</span> <span class="val">${b.time}</span></p>
                            <p><span class="label">Symptoms:</span> <span class="val">${escapeHTML(b.symptoms || '')}</span></p>
                        </div>
                        <div class="ticket-footer">
                            ${b.status === 'pending' || b.status === 'accepted' ? 
                            `<button onclick="removeBooking('${b.token}')" class="btn-ticket-cancel">
                                <i class="fa-solid fa-ban"></i> Cancel Booking
                            </button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error(err);
    }
}

// --- UTILITY MODAL CONTROLLER ---
function showModal(title, bodyHtml, isWarning = false, actionUrl = null) {
    const modal = document.getElementById("customModal");
    const modalHeader = document.getElementById("modalHeader");
    const modalTitle = document.getElementById("modalTitle");
    const modalBody = document.getElementById("modalBody");
    const actionBtn = document.getElementById("modalActionBtn");

    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHtml;

    // Adjust theme color on warnings
    if (isWarning) {
        modalHeader.className = "modal-header warning";
        modalHeader.querySelector("i").className = "fa-solid fa-circle-exclamation modal-icon";
    } else {
        modalHeader.className = "modal-header";
        modalHeader.querySelector("i").className = "fa-solid fa-circle-check modal-icon";
    }

    // Configure Action Button (e.g. WhatsApp redirection)
    if (actionUrl) {
        actionBtn.style.display = "block";
        actionBtn.onclick = () => {
            window.open(actionUrl, "_blank");
            closeModal();
        };
    } else {
        actionBtn.style.display = "none";
    }

    modal.classList.add("active");
}

function closeModal() {
    document.getElementById("customModal").classList.remove("active");
}

// Escapes special HTML tags to prevent XSS in Local Storage rendering
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// --- LIGHTBOX CONTROLLER ---
function openLightbox(imgSrc) {
    const lightbox = document.getElementById("lightbox");
    const lightboxImg = document.getElementById("lightboxImg");
    if (lightbox && lightboxImg) {
        lightboxImg.src = imgSrc;
        lightbox.classList.add("active");
    }
}

function closeLightbox() {
    const lightbox = document.getElementById("lightbox");
    if (lightbox) {
        lightbox.classList.remove("active");
    }
}

// --- GOOGLE SIGN-IN & SPLASH SCREEN SYSTEM ---
function initAuth() {
    const isLoggedIn = localStorage.getItem("dp_authenticated") === "true";
    const splashScreen = document.getElementById("splashScreen");
    const loginScreen = document.getElementById("loginScreen");
    const appContainer = document.getElementById("appContainer");

    // Clear dropdowns when clicking outside
    document.addEventListener("click", (e) => {
        const dropdown = document.getElementById("profileDropdown");
        const avatarBtn = document.getElementById("avatarBtn");
        if (dropdown && avatarBtn && !dropdown.contains(e.target) && !avatarBtn.contains(e.target)) {
            dropdown.classList.remove("active");
        }
    });

    // 2.5 seconds splash display before transitioning
    setTimeout(() => {
        if (splashScreen) {
            splashScreen.classList.add("fade-out");
            setTimeout(() => {
                splashScreen.classList.add("hidden");
            }, 600);
        }

        if (isLoggedIn) {
            // User is logged in, show main container directly
            if (appContainer) appContainer.classList.remove("hidden");
            setupUserProfileHeader();
        } else {
            // User is not logged in, show login card
            if (loginScreen) loginScreen.classList.remove("hidden");
        }
    }, 2500);
}

function openEmailAuth() {
    const modal = document.getElementById("emailAuthModal");
    if (modal) modal.classList.remove("hidden");
}

function closeEmailAuth() {
    const modal = document.getElementById("emailAuthModal");
    if (modal) modal.classList.add("hidden");
    resetEmailAuth();
}

function resetEmailAuth() {
    document.getElementById("otpRequestForm").classList.remove("hidden");
    document.getElementById("otpVerifyForm").classList.add("hidden");
    document.getElementById("authOtp").value = "";
}

async function handleOtpRequest(event) {
    event.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const btn = document.getElementById("requestOtpBtn");
    
    if (!email) {
        alert("Please enter a valid email address.");
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

    try {
        const res = await fetch(`${API_BASE}/request-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        if (res.ok) {
            // Show verification form
            document.getElementById("otpRequestForm").classList.add("hidden");
            document.getElementById("otpVerifyForm").classList.remove("hidden");
            console.log("Email Preview URL (for testing):", data.previewUrl);
        } else {
            alert(data.error || "Failed to send OTP");
        }
    } catch (err) {
        console.error(err);
        alert("Server error. Make sure the backend is running.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Send OTP';
    }
}

async function handleOtpVerify(event) {
    event.preventDefault();
    const email = document.getElementById("authEmail").value.trim();
    const otp = document.getElementById("authOtp").value.trim();
    const btn = document.getElementById("verifyOtpBtn");
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';

    try {
        const res = await fetch(`${API_BASE}/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        
        if (res.ok) {
            // Login successful
            const name = email.split('@')[0];
            const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
            
            localStorage.setItem("dp_authenticated", "true");
            localStorage.setItem("dp_user_name", name);
            localStorage.setItem("dp_user_email", email);
            localStorage.setItem("dp_user_avatar", avatarUrl);
            
            closeEmailAuth();
            
            // Hide Login Gate
            const loginScreen = document.getElementById("loginScreen");
            if (loginScreen) {
                loginScreen.classList.add("fade-out");
                setTimeout(() => {
                    loginScreen.classList.add("hidden");
                }, 600);
            }

            // Show App Container
            const appContainer = document.getElementById("appContainer");
            if (appContainer) {
                appContainer.classList.remove("hidden");
            }

            setupUserProfileHeader();
            renderBookings(); // Fetch new bookings for this user
            
            showModal("Welcome!", `Welcome! You have successfully signed in with your email: <strong>${email}</strong>.`, false);
        } else {
            alert(data.error || "Invalid OTP");
        }
    } catch (err) {
        console.error(err);
        alert("Server error.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Verify OTP';
    }
}

function setupUserProfileHeader() {
    const name = localStorage.getItem("dp_user_name") || "Guest User";
    const email = localStorage.getItem("dp_user_email") || "guest@gmail.com";
    const avatar = localStorage.getItem("dp_user_avatar") || "";

    const userProfileMenu = document.getElementById("userProfileMenu");
    const userAvatar = document.getElementById("userAvatar");
    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");

    if (userProfileMenu && userAvatar && profileName && profileEmail) {
        userAvatar.src = avatar;
        profileName.textContent = name;
        profileEmail.textContent = email;
        userProfileMenu.style.display = "block";
    }
}

function toggleProfileDropdown() {
    const dropdown = document.getElementById("profileDropdown");
    if (dropdown) {
        dropdown.classList.toggle("active");
    }
}

function handleSignOut() {
    localStorage.removeItem("dp_authenticated");
    localStorage.removeItem("dp_user_name");
    localStorage.removeItem("dp_user_email");
    localStorage.removeItem("dp_user_avatar");

    const userProfileMenu = document.getElementById("userProfileMenu");
    if (userProfileMenu) userProfileMenu.style.display = "none";
    
    const dropdown = document.getElementById("profileDropdown");
    if (dropdown) dropdown.classList.remove("active");

    window.location.reload();
}

// --- GALLERY FILTER CONTROLLER ---
function filterGallery(category) {
    const tabBtns = document.querySelectorAll(".gallery-tab-btn");
    const items = document.querySelectorAll(".gallery-item");

    tabBtns.forEach(btn => {
        if (btn.getAttribute("onclick").includes(category)) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    items.forEach(item => {
        if (item.classList.contains(`${category}-item`)) {
            item.classList.remove("hidden");
        } else {
            item.classList.add("hidden");
        }
    });
}

// --- EDUCATION CARD TOGGLER ---
function toggleMoreEducation() {
    const hiddenCards = document.querySelectorAll(".education-card.edu-card-hidden");
    const btn = document.getElementById("toggleEduBtn");
    
    let isShowing = false;
    hiddenCards.forEach(card => {
        card.classList.toggle("active-show");
        if (card.classList.contains("active-show")) {
            isShowing = true;
        }
    });

    if (isShowing) {
        btn.innerHTML = '<i class="fa-solid fa-chevron-up"></i> Show Less';
    } else {
        btn.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Show More Insights';
    }
}

// ============================================================
//  PREMIUM ANIMATIONS — Scroll Reveal, Navbar Glow, Counters
// ============================================================

// --- Scroll-Reveal via IntersectionObserver ---
function initScrollReveal() {
    const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
    if (!revealEls.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); // animate once
            }
        });
    }, { threshold: 0.12 });

    revealEls.forEach(el => observer.observe(el));
}

// --- Navbar Glow on Scroll ---
function initNavbarGlow() {
    const header = document.querySelector('.navbar-header');
    if (!header) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 60) {
            header.classList.add('scrolled-glow');
        } else {
            header.classList.remove('scrolled-glow');
        }
    }, { passive: true });
}

// --- Animated Stat Counters ---
function animateCounters() {
    const counters = document.querySelectorAll('.stat-count[data-target]');
    counters.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-target'));
        const suffix = counter.getAttribute('data-suffix') || '';
        const duration = 1600;
        const step = Math.ceil(target / (duration / 16));
        let current = 0;

        const timer = setInterval(() => {
            current += step;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            counter.textContent = current.toLocaleString() + suffix;
        }, 16);
    });
}

// Trigger counters when stats section comes into view
function initStatCounters() {
    const statsSection = document.querySelector('.stats-section, .hero-stats, .stats-grid');
    if (!statsSection) return;

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            animateCounters();
            observer.disconnect();
        }
    }, { threshold: 0.3 });

    observer.observe(statsSection);
}

// --- Inject Floating Hero Orbs ---
function injectHeroOrbs() {
    const hero = document.querySelector('.hero-section');
    if (!hero || hero.querySelector('.hero-orb')) return;

    ['hero-orb hero-orb-1', 'hero-orb hero-orb-2', 'hero-orb hero-orb-3'].forEach(cls => {
        const orb = document.createElement('div');
        orb.className = cls;
        hero.appendChild(orb);
    });
}

// --- Button Ripple Effect ---
function initRipple() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn, .btn-primary, .btn-secondary, .gallery-tab-btn');
        if (!btn) return;

        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.cssText = `
            width: ${size}px; height: ${size}px;
            left: ${e.clientX - rect.left - size / 2}px;
            top:  ${e.clientY - rect.top  - size / 2}px;
        `;
        btn.style.position = 'relative';
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 650);
    });
}

// --- Wire up all premium animations on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initNavbarGlow();
    initStatCounters();
    injectHeroOrbs();
    initRipple();
});


// ============================================================
//  VIDEO CONSULTATION — Patient Side
// ============================================================

let availableVideoSlots = [];

// Fetch and render available video slots
async function fetchVideoSlots() {
    const container = document.getElementById('videoSlotsContainer');
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/video-slots`);
        availableVideoSlots = await res.json();

        if (!availableVideoSlots.length) {
            container.innerHTML = `
                <div class="no-slots-msg">
                    <i class="fa-solid fa-calendar-xmark"></i>
                    <p>No video slots available right now.</p>
                    <small>Please check back later or call us directly.</small>
                </div>`;
            return;
        }

        container.innerHTML = '';
        availableVideoSlots.forEach(slot => {
            const dateObj = new Date(slot.date + 'T00:00:00');
            const displayDate = dateObj.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const [h, m] = slot.time.split(':');
            const hour = parseInt(h);
            const displayTime = `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;

            const card = document.createElement('div');
            card.className = 'slot-card';
            card.id = `slot-${slot.id}`;
            card.innerHTML = `
                <div class="slot-date"><i class="fa-solid fa-calendar-day"></i> ${displayDate}</div>
                <div class="slot-time"><i class="fa-solid fa-clock"></i> ${displayTime}</div>
                <div class="slot-spots"><i class="fa-solid fa-user-check"></i> ${slot.max_bookings - slot.booked_count} spot(s) left</div>
                <button class="btn btn-slot-select" onclick="selectVideoSlot(${slot.id}, '${displayDate}', '${displayTime}')">
                    Select This Slot
                </button>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.error('Error loading video slots:', err);
        if (container) {
            container.innerHTML = '<div class="no-slots-msg"><p>Could not load slots. Server may be offline.</p></div>';
        }
    }
}

// Called when patient clicks a slot card
function selectVideoSlot(slotId, displayDate, displayTime) {
    // Remove active class from all slot cards
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('slot-selected'));
    const selected = document.getElementById(`slot-${slotId}`);
    if (selected) selected.classList.add('slot-selected');

    // Populate hidden inputs and readonly display
    document.getElementById('vcSlotId').value = slotId;
    document.getElementById('vcSelectedSlot').value = `${displayDate} at ${displayTime}`;
}

// Submit video consultation booking
async function bookVideoConsultation(event) {
    event.preventDefault();

    const userEmail = localStorage.getItem('dp_user_email');
    if (!userEmail) {
        alert('Please log in first to book a video consultation.');
        return;
    }

    const slotId = document.getElementById('vcSlotId').value;
    if (!slotId) {
        alert('Please select an available slot on the left.');
        return;
    }

    const submitBtn = document.getElementById('vcSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking...';

    const body = {
        user_email: userEmail,
        patient_name: document.getElementById('vcName').value,
        phone: document.getElementById('vcPhone').value,
        age: parseInt(document.getElementById('vcAge').value),
        slot_id: parseInt(slotId),
        symptoms: document.getElementById('vcSymptoms').value
    };

    try {
        const res = await fetch(`${API_BASE}/book-video`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        if (res.ok) {
            document.getElementById('videoBookingForm').reset();
            document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('slot-selected'));
            fetchVideoSlots(); // refresh slots
            renderVideoBookings(); // refresh dashboard
            showToast(`✅ Booked! Token: ${data.token}. You'll receive a Meet link after admin confirms.`, 'success');
        } else {
            showToast(data.error || 'Booking failed. Please try again.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Server error. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-video"></i> Request Video Consultation';
    }
}

// Render video appointments in patient dashboard
async function renderVideoBookings() {
    const listEl = document.getElementById('videoBookingsList');
    const noEl = document.getElementById('noVideoBookings');
    if (!listEl || !noEl) return;

    const email = localStorage.getItem('dp_user_email');
    if (!email) return;

    try {
        const res = await fetch(`${API_BASE}/my-video-appointments?email=${encodeURIComponent(email)}`);
        const appts = await res.json();

        listEl.innerHTML = '';
        if (!appts.length) {
            noEl.style.display = 'block';
            listEl.style.display = 'none';
            return;
        }

        noEl.style.display = 'none';
        listEl.style.display = 'grid';

        appts.forEach(appt => {
            const card = document.createElement('div');
            card.className = `booking-card-item status-${appt.status}`;

            const meetBtn = appt.meet_link
                ? `<a href="${appt.meet_link}" target="_blank" class="btn btn-meet btn-sm">
                    <i class="fa-solid fa-video"></i> Join Meet
                   </a>`
                : '';

            const statusIcon = {
                pending: '<i class="fa-solid fa-clock"></i>',
                accepted: '<i class="fa-solid fa-circle-check"></i>',
                rejected: '<i class="fa-solid fa-circle-xmark"></i>'
            }[appt.status] || '';

            card.innerHTML = `
                <div class="booking-card-header">
                    <span class="booking-token"><i class="fa-solid fa-video"></i> ${appt.token}</span>
                    <span class="status-pill status-${appt.status}">${statusIcon} ${appt.status.toUpperCase()}</span>
                </div>
                <div class="booking-card-body">
                    <p><i class="fa-solid fa-calendar-day"></i> <strong>${appt.date}</strong> at <strong>${appt.time}</strong></p>
                    <p><i class="fa-solid fa-user-doctor"></i> Dr. Mahalakshmi Peruri</p>
                    ${appt.symptoms ? `<p><i class="fa-solid fa-notes-medical"></i> ${appt.symptoms}</p>` : ''}
                </div>
                <div class="booking-card-footer">
                    ${meetBtn}
                </div>
            `;
            listEl.appendChild(card);
        });
    } catch (err) {
        console.error('Error loading video appointments:', err);
    }
}

// Switch between Clinic and Video tabs in dashboard
function switchDashTab(tabId) {
    document.querySelectorAll('.dash-tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.dash-tab-btn').forEach(b => b.classList.remove('active'));

    document.getElementById(tabId).classList.remove('hidden');
    event.currentTarget.classList.add('active');
}

// Simple toast notification helper
function showToast(message, type = 'success') {
    let toast = document.getElementById('pageToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pageToast';
        toast.style.cssText = `
            position:fixed; bottom:30px; left:50%; transform:translateX(-50%) translateY(80px);
            z-index:9999; padding:14px 28px; border-radius:30px; font-size:14px; font-weight:500;
            box-shadow:0 8px 32px rgba(0,0,0,0.25); transition:all 0.4s cubic-bezier(0.22,1,0.36,1);
            opacity:0; pointer-events:none; max-width:90vw; text-align:center;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.background = type === 'error'
        ? 'linear-gradient(135deg,#c0392b,#e74c3c)'
        : 'linear-gradient(135deg,#1e3c72,#00d2d3)';
    toast.style.color = '#fff';
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(80px)';
    }, 4000);
}
