import { useNavigate } from 'react-router-dom';

const variants = {
    // Floating pill used over full-screen simulations.
    pill: {
        position: 'absolute', top: '20px', left: '20px', zIndex: 10,
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
        color: 'white', padding: '10px 20px', borderRadius: '30px', cursor: 'pointer',
        backdropFilter: 'blur(10px)', fontWeight: '600',
    },
    // Inline pill used in page headers (lab and solver pages).
    inline: {
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
        color: 'white', padding: '10px 20px', borderRadius: '30px', cursor: 'pointer',
    },
};

/** Returns to the landing page through the router (works under any base path). */
export default function HomeButton({ variant = 'pill', label = '← Home' }) {
    const navigate = useNavigate();
    return (
        <button type="button" onClick={() => navigate('/')} style={variants[variant]}>
            {label}
        </button>
    );
}
