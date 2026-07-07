// Language Preferences System
// Supports EN/FR language switching

const translations = {
    en: {
        // Header
        'brand-name': 'Tany',
        'brand-tag': 'Real estate OS',
        'nav-dashboard': 'Dashboard',
        'nav-market': 'Market Place',
        'nav-messages': 'Private Message',
        'nav-legal': 'Land law',
        'btn-logout': 'Log Out',
        
        // Dashboard
        'page-title-dashboard': 'Parcel Operations',
        'page-subtitle-dashboard': 'Live overview of your Parcels, tasks, and overviews.',
        'map-title': 'Field Data Manager',
        'map-badge': 'Live',
        
        // Market Place
        'page-title-market': 'Market Place',
        'page-subtitle-market': 'Browse listings, buy, and sell produce directly.',
        
        // Messages
        'page-title-messages': 'Private Message',
        'page-subtitle-messages': 'Communicate securely with your network.',
        
        // Legal
        'page-title-legal': 'Land Law',
        
        // Auth Pages
        'signin-welcome': 'Welcome Back',
        'signin-subtitle': 'Sign in to your account',
        'signin-email': 'Email Address',
        'signin-password': 'Password',
        'signin-button': 'Sign In',
        'signin-no-account': 'Don\'t have an account?',
        'signin-signup': 'Create one now',
        
        'signup-title': 'Create Account',
        'signup-subtitle': 'Join us today and get started',
        'signup-name': 'Full Name',
        'signup-email': 'Email Address',
        'signup-password': 'Password',
        'signup-username': 'Username',
        'signup-mobile': 'Mobile Number',
        'signup-address': 'Address',
        'signup-id': 'ID Card Number',
        'signup-account-type': 'Account type',
        'signup-button': 'Sign Up',
        'signup-already': 'Already have an account?',
        'signup-signin': 'Sign In',
        
        // Chat
        'chat-title': 'PropertyHub',
        'chat-admin-button': '+ Write to Admin',
        'chat-placeholder': 'Ask about properties, prices, availability...',
        'admin-modal-title': 'Write to Admin',
        'admin-modal-subtitle': 'Your message will be sent directly to the admin team.',
        'admin-subject': 'Subject',
        'admin-subject-placeholder': 'Issue with my account',
        'admin-message': 'Message',
        'admin-message-placeholder': 'Describe your issue or question...',
        'admin-cancel': 'Cancel',
        'admin-send': 'Send message',
    },
    fr: {
        // Header
        'brand-name': 'Tany',
        'brand-tag': 'OS immobilier',
        'nav-dashboard': 'Tableau de bord',
        'nav-market': 'Marché',
        'nav-messages': 'Messages privés',
        'nav-legal': 'Droit foncier',
        'btn-logout': 'Déconnexion',
        
        // Dashboard
        'page-title-dashboard': 'Opérations foncières',
        'page-subtitle-dashboard': 'Aperçu en direct de vos parcelles, tâches et résumés.',
        'map-title': 'Gestionnaire de données foncières',
        'map-badge': 'En direct',
        
        // Market Place
        'page-title-market': 'Marché',
        'page-subtitle-market': 'Parcourez les annonces, achetez et vendez directement.',
        
        // Messages
        'page-title-messages': 'Messages privés',
        'page-subtitle-messages': 'Communiquez en toute sécurité avec votre réseau.',
        
        // Legal
        'page-title-legal': 'Droit foncier',
        
        // Auth Pages
        'signin-welcome': 'Bienvenue',
        'signin-subtitle': 'Connectez-vous à votre compte',
        'signin-email': 'Adresse e-mail',
        'signin-password': 'Mot de passe',
        'signin-button': 'Connexion',
        'signin-no-account': 'Vous n\'avez pas de compte ?',
        'signin-signup': 'En créer un maintenant',
        
        'signup-title': 'Créer un compte',
        'signup-subtitle': 'Rejoignez-nous et commencez dès aujourd\'hui',
        'signup-name': 'Nom complet',
        'signup-email': 'Adresse e-mail',
        'signup-password': 'Mot de passe',
        'signup-username': 'Nom d\'utilisateur',
        'signup-mobile': 'Numéro de téléphone',
        'signup-address': 'Adresse',
        'signup-id': 'Numéro de carte d\'identité',
        'signup-account-type': 'Type de compte',
        'signup-button': 'Créer un compte',
        'signup-already': 'Vous avez déjà un compte ?',
        'signup-signin': 'Se connecter',
        
        // Chat
        'chat-title': 'PropertyHub',
        'chat-admin-button': '+ Écrire à l\'admin',
        'chat-placeholder': 'Posez vos questions sur les propriétés, les prix, la disponibilité...',
        'admin-modal-title': 'Écrire à l\'administrateur',
        'admin-modal-subtitle': 'Votre message sera envoyé directement à l\'équipe d\'administration.',
        'admin-subject': 'Sujet',
        'admin-subject-placeholder': 'Problème avec mon compte',
        'admin-message': 'Message',
        'admin-message-placeholder': 'Décrivez votre problème ou votre question...',
        'admin-cancel': 'Annuler',
        'admin-send': 'Envoyer le message',
    }
};

// Initialize language system
class LanguageManager {
    constructor() {
        this.currentLang = localStorage.getItem('language') || 'en';
        this.init();
    }

    init() {
        // Set initial language
        this.setLanguage(this.currentLang);
        
        // Create language switcher if not exists
        this.createLanguageSwitcher();
    }

    setLanguage(lang) {
        if (!translations[lang]) return;
        
        this.currentLang = lang;
        localStorage.setItem('language', lang);
        
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = translations[lang][key];
            
            if (translation) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    if (element.hasAttribute('placeholder')) {
                        element.placeholder = translation;
                    } else {
                        element.value = translation;
                    }
                } else {
                    element.textContent = translation;
                }
            }
        });
        
        // Update language button
        const langBtn = document.getElementById('language-switcher');
        if (langBtn) {
            langBtn.textContent = lang === 'en' ? 'Français' : 'English';
        }
        
        // Update document language attribute
        document.documentElement.lang = lang;
    }

    createLanguageSwitcher() {
        // Check if switcher already exists
        if (document.getElementById('language-switcher')) return;
        
        // Find header-right section
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;
        
        // Create button
        const button = document.createElement('button');
        button.id = 'language-switcher';
        button.className = 'btn-language';
        button.textContent = this.currentLang === 'en' ? 'Français' : 'English';
        button.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.45rem;
            background: #f3f4f6;
            color: #6b7280;
            border: 1px solid #e5e7eb;
            padding: 0.5rem 0.85rem;
            border-radius: 8px;
            font-size: 0.825rem;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            transition: all 0.15s;
        `;
        
        button.addEventListener('mouseover', () => {
            button.style.background = '#10b981';
            button.style.color = 'white';
            button.style.borderColor = '#10b981';
        });
        
        button.addEventListener('mouseout', () => {
            button.style.background = '#f3f4f6';
            button.style.color = '#6b7280';
            button.style.borderColor = '#e5e7eb';
        });
        
        button.addEventListener('click', () => {
            const newLang = this.currentLang === 'en' ? 'fr' : 'en';
            this.setLanguage(newLang);
        });
        
        // Insert before logout button if exists, otherwise prepend
        const logoutBtn = document.querySelector('.btn-logout');
        if (logoutBtn) {
            logoutBtn.parentElement.insertBefore(button, logoutBtn);
        } else {
            headerRight.insertBefore(button, headerRight.firstChild);
        }
    }

    get(key) {
        return translations[this.currentLang][key] || translations['en'][key] || key;
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new LanguageManager();
    });
} else {
    new LanguageManager();
}
