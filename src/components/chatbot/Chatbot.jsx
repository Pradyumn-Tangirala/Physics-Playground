import { useState, useRef, useEffect } from 'react';
import { answerFor, chatWindowRect, FAB_SIZE, EDGE } from './chatbotLogic';
import { clamp } from '../../utils/math';
import styles from './Chatbot.module.css';

const DRAG_THRESHOLD = 5; // px of movement before a press counts as a drag
const MAX_QUESTION_LENGTH = 300; // characters; the FAQ only looks for keywords
const FAB_START_INSET = 90; // px from the bottom-right corner where the button starts

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 0, text: "Hi! I'm the Wave Lab help bot, a simple keyword-based FAQ (not an AI). Ask about diffraction, interference, the slits, frequency, phase or the screen.", sender: 'bot' }
    ]);
    const [inputText, setInputText] = useState('');
    const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [position, setPosition] = useState({ x: window.innerWidth - FAB_START_INSET, y: window.innerHeight - FAB_START_INSET });
    const [isDragging, setIsDragging] = useState(false);

    // Drag bookkeeping lives in a ref: it is interaction state, not render state.
    const dragRef = useRef(null);
    const nextIdRef = useRef(1);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    useEffect(() => {
        const handleResize = () => {
            setViewport({ width: window.innerWidth, height: window.innerHeight });
            setPosition(prev => ({
                x: clamp(prev.x, EDGE, window.innerWidth - FAB_SIZE - EDGE),
                y: clamp(prev.y, EDGE, window.innerHeight - FAB_SIZE - EDGE),
            }));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handlePointerDown = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            offsetX: e.clientX - position.x,
            offsetY: e.clientY - position.y,
            moved: false,
        };
    };

    const handlePointerMove = (e) => {
        const drag = dragRef.current;
        if (!drag) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
        if (!drag.moved) {
            drag.moved = true;
            setIsDragging(true);
        }
        setPosition({
            x: clamp(e.clientX - drag.offsetX, EDGE, window.innerWidth - FAB_SIZE - EDGE),
            y: clamp(e.clientY - drag.offsetY, EDGE, window.innerHeight - FAB_SIZE - EDGE),
        });
    };

    const handlePointerUp = () => {
        setIsDragging(false);
        // Keep dragRef until the click event so it can tell a drag from a click.
    };

    const handleClick = () => {
        const wasDrag = dragRef.current?.moved;
        dragRef.current = null;
        if (!wasDrag) setIsOpen(prev => !prev);
    };

    const handleSend = (e) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text) return;
        const userId = nextIdRef.current++;
        const botId = nextIdRef.current++;
        setMessages(prev => [
            ...prev,
            { id: userId, text, sender: 'user' },
            { id: botId, text: answerFor(text), sender: 'bot' },
        ]);
        setInputText('');
    };

    const win = chatWindowRect(position, viewport);

    return (
        <>
            <div
                role="dialog"
                aria-label="Wave Lab help"
                aria-hidden={!isOpen}
                inert={!isOpen}
                className={`${styles.window} ${isOpen ? styles.open : ''}`}
                style={{ left: win.left, top: win.top, width: win.width, height: win.height }}
            >
                <div className={styles.header}>
                    <h3>Wave Lab Help</h3>
                    <span className={styles.tag}>FAQ</span>
                    <button type="button" className={styles.close} onClick={() => setIsOpen(false)} aria-label="Close help">×</button>
                </div>

                <div className={styles.messages}>
                    {messages.map((msg) => (
                        <div key={msg.id} className={`${styles.message} ${msg.sender === 'user' ? styles.user : styles.bot}`}>
                            {msg.text}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className={styles.form}>
                    <input
                        type="text"
                        aria-label="Your question"
                        value={inputText}
                        maxLength={MAX_QUESTION_LENGTH}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Ask a question..."
                        className={styles.input}
                    />
                    <button type="submit" aria-label="Send" className={styles.send}>➤</button>
                </form>
            </div>

            {/* Drag to move, click to toggle. */}
            <button
                type="button"
                aria-label={isOpen ? 'Close help' : 'Open Wave Lab help'}
                aria-expanded={isOpen}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onClick={handleClick}
                className={`${styles.fab} ${isDragging ? styles.dragging : ''}`}
                style={{ left: position.x, top: position.y, '--fab-size': `${FAB_SIZE}px` }}
            >
                {isOpen ? '✕' : '💬'}
            </button>
        </>
    );
};

export default Chatbot;
