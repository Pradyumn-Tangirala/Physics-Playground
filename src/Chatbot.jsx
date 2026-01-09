import React, { useState, useRef, useEffect } from 'react';

const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, text: "Hi! I'm Speed, your AI physics assistant. Ask me anything about diffraction or the simulation!", sender: 'bot' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Dragging State
    const [position, setPosition] = useState({ x: window.innerWidth - 90, y: window.innerHeight - 90 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const messagesEndRef = useRef(null);
    const chatWindowRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    // Handle Window Resize to keep button on screen
    useEffect(() => {
        const handleResize = () => {
            setPosition(prev => ({
                x: Math.min(prev.x, window.innerWidth - 70),
                y: Math.min(prev.y, window.innerHeight - 70)
            }));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Drag Handlers
    const handleMouseDown = (e) => {
        // Only allow dragging from the button itself, not the chat window content
        if (isOpen && chatWindowRef.current && chatWindowRef.current.contains(e.target)) {
            return;
        }

        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
        // Store start position to distinguish click from drag
        e.target.dataset.startX = e.clientX;
        e.target.dataset.startY = e.clientY;
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;

        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        // Boundary checks
        const boundedX = Math.max(10, Math.min(window.innerWidth - 70, newX));
        const boundedY = Math.max(10, Math.min(window.innerHeight - 70, newY));

        setPosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = (e) => {
        setIsDragging(false);

        // Check if it was a click (minimal movement)
        const startX = parseFloat(e.target.dataset.startX || 0);
        const startY = parseFloat(e.target.dataset.startY || 0);
        const dist = Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2));

        if (dist < 5) {
            setIsOpen(prev => !prev);
        }
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);


    const generateResponse = (query) => {
        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes('diffraction')) {
            return "Diffraction is the bending of waves around obstacles or through openings. It's most pronounced when the opening size is close to the wavelength.";
        }
        if (lowerQuery.includes('interference')) {
            return "Interference happens when two waves overlap. 'Constructive' interference makes bright spots (peaks align), and 'Destructive' interference makes dark spots (peak meets trough).";
        }
        if (lowerQuery.includes('slit') || lowerQuery.includes('separation')) {
            return "The 'Slit Separation' controls the distance between the two light sources. Increasing it brings the interference fringes closer together.";
        }
        if (lowerQuery.includes('frequency') || lowerQuery.includes('color') || lowerQuery.includes('wavelength')) {
            return "Frequency determines the color of light. Higher frequency (blue/violet) means shorter wavelength and tighter interference patterns. Lower frequency (red) means longer wavelength.";
        }
        if (lowerQuery.includes('phase')) {
            return "Phase shift changes the starting point of one wave relative to the other. Changing it shifts the entire interference pattern left or right.";
        }
        if (lowerQuery.includes('wall') || lowerQuery.includes('barrier')) {
            return "The 'Double Slit Barrier' toggle switches between a simple two-source model and a realistic wall with two slits. The wall blocks waves, creating a shadow zone.";
        }
        if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || lowerQuery.includes('hey')) {
            return "Hello there! Ready to explore some physics?";
        }
        if (lowerQuery.includes('who are you') || lowerQuery.includes('name')) {
            return "I'm Speed! I was built to help you understand wave physics.";
        }

        return "I'm not sure about that one yet. Try asking about 'diffraction', 'frequency', 'interference', or the 'controls'.";
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const userMessage = { id: Date.now(), text: inputText, sender: 'user' };
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsTyping(true);

        // Simulate AI delay
        setTimeout(() => {
            const responseText = generateResponse(userMessage.text);
            const botMessage = { id: Date.now() + 1, text: responseText, sender: 'bot' };
            setMessages(prev => [...prev, botMessage]);
            setIsTyping(false);
        }, 1000 + Math.random() * 500);
    };

    return (
        <div style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 1000,
            fontFamily: "'Inter', sans-serif",
            touchAction: 'none' // Prevent scrolling while dragging on touch devices
        }}>
            {/* Chat Window */}
            <div
                ref={chatWindowRef}
                style={{
                    position: 'absolute',
                    bottom: '80px',
                    right: '0',
                    width: '350px',
                    height: '500px',
                    background: 'rgba(20, 20, 30, 0.85)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transform: isOpen ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(20px)',
                    opacity: isOpen ? 1 : 0,
                    pointerEvents: isOpen ? 'all' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.19, 1, 0.22, 1)',
                    transformOrigin: 'bottom right'
                }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    background: 'linear-gradient(90deg, #ff4b2b, #ff416c)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    boxShadow: '0 5px 15px rgba(255, 75, 43, 0.3)',
                    cursor: 'default'
                }}>
                    <div style={{
                        width: '10px',
                        height: '10px',
                        background: '#00ff00',
                        borderRadius: '50%',
                        boxShadow: '0 0 10px #00ff00'
                    }}></div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>Speed AI</h3>
                    <button
                        onClick={() => setIsOpen(false)}
                        style={{
                            marginLeft: 'auto',
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            fontSize: '1.2rem',
                            cursor: 'pointer'
                        }}
                    >×</button>
                </div>

                {/* Messages Area */}
                <div style={{
                    flex: 1,
                    padding: '20px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px'
                }}>
                    {messages.map((msg) => (
                        <div key={msg.id} style={{
                            alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '80%',
                            padding: '12px 16px',
                            borderRadius: '16px',
                            borderBottomRightRadius: msg.sender === 'user' ? '4px' : '16px',
                            borderBottomLeftRadius: msg.sender === 'bot' ? '4px' : '16px',
                            background: msg.sender === 'user' ? 'linear-gradient(135deg, #ff4b2b, #ff416c)' : 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            fontSize: '0.95rem',
                            lineHeight: '1.5',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                        }}>
                            {msg.text}
                        </div>
                    ))}
                    {isTyping && (
                        <div style={{
                            alignSelf: 'flex-start',
                            background: 'rgba(255, 255, 255, 0.1)',
                            padding: '12px 16px',
                            borderRadius: '16px',
                            borderBottomLeftRadius: '4px',
                            display: 'flex',
                            gap: '5px'
                        }}>
                            <span className="dot" style={{ animationDelay: '0s' }}>•</span>
                            <span className="dot" style={{ animationDelay: '0.2s' }}>•</span>
                            <span className="dot" style={{ animationDelay: '0.4s' }}>•</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} style={{
                    padding: '15px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    display: 'flex',
                    gap: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Ask a question..."
                        style={{
                            flex: 1,
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '25px',
                            padding: '12px 20px',
                            color: 'white',
                            outline: 'none',
                            fontSize: '0.95rem',
                            transition: 'all 0.3s'
                        }}
                        onFocus={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onBlur={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.05)'}
                    />
                    <button type="submit" style={{
                        background: 'linear-gradient(135deg, #ff4b2b, #ff416c)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '45px',
                        height: '45px',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 5px 15px rgba(255, 75, 43, 0.3)',
                        transition: 'transform 0.2s'
                    }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        ➤
                    </button>
                </form>
            </div>

            {/* Floating Action Button (Draggable Handle) */}
            <div
                onMouseDown={handleMouseDown}
                style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ff4b2b, #ff416c)',
                    boxShadow: '0 10px 30px rgba(255, 75, 43, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    userSelect: 'none'
                }}
                onMouseOver={(e) => !isDragging && (e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)')}
                onMouseOut={(e) => !isDragging && (e.currentTarget.style.transform = 'scale(1) rotate(0deg)')}
            >
                <button
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        fontSize: '1.8rem',
                        cursor: 'pointer', // The click is handled by the parent div mostly, but this ensures pointer
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none' // Let events pass to parent div which handles drag/click
                    }}
                >
                    {isOpen ? '✕' : '💬'}
                </button>
            </div>

            <style>{`
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        .dot {
            animation: bounce 1s infinite;
            font-size: 1.5rem;
            line-height: 0.5;
        }
      `}</style>
        </div>
    );
};

export default Chatbot;
