# Physics Playground

**Physics Playground** is an interactive, web-based simulation suite designed to visualize and experiment with fundamental physics concepts. Built with **React** and the **HTML5 Canvas API**, this application offers real-time, high-fidelity simulations of wave interference, projectile motion, and simple harmonic motion (SHM).

## 🚀 Features

### 1. Projectile Motion Simulator
A robust engine for analyzing parabolic trajectories under varying conditions.
*   **Real-time Rendering**: accurate 60FPS physics loop using `requestAnimationFrame`.
*   **Predictive Trajectory**: Calculates and renders the complete flight path using a specialized Runge-Kutta approximation before launch.
*   **Dynamic HUD**: Interactive Heads-Up Display showing instantaneous Height (H), Distance (D), and Time (T).
*   **Post-Flight Analytics**: Detailed flight report card upon landing.
*   **Customizable Parameters**:
    *   Velocity ($10 - 100 \text{ m/s}$)
    *   Launch Angle ($0^\circ - 90^\circ$)
    *   Gravity ($1 - 25 \text{ m/s}^2$)

### 2. Simple Harmonic Motion (SHM) Lab
A dual-mode oscillator laboratory for studying periodic motion.
*   **Dual Modules**: Seamless switching between **Simple Pendulum** and **Spring-Mass System**.
*   **Energy Visualization**: Real-time bar charts visualizing the conservation of energy (kinetic vs. potential).
*   **Data Logging**: Live rolling graph plotting Displacement/Angle vs. Time.
*   **Interactive Physics**:
    *   Adjustable Damping (Air Resistance/Friction).
    *   Configurable Mass, Spring Constant ($k$), and String Length ($L$).
    *   Manual and Slider-based inputs for precision control.

### 3. Wave Interference Engine
A high-performance wave equation solver visualizing interference patterns.
*   **Heatmap Visualization**: Color-coded amplitude rendering for visualizing constructive and destructive interference.
*   **Source Configuration**: Adjustable dual-source separation, frequency, and phase shift.
*   **Wall Mode**: Simulates diffraction through single or double slits.

## 🛠️ Technical Stack

*   **Frontend Framework**: [React 18](https://reactjs.org/)
*   **Build Tool**: [Vite](https://vitejs.dev/)
*   **Rendering Engine**: HTML5 Canvas API (2D Context)
*   **Styling**: CSS Modules with Glassmorphism UI design language
*   **Mathematics**: Custom physics engines implementing kinematic equations and differential solvers.

## 📦 Installation & Setup

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Pradyumn-Tangirala/Physics-Playground.git
    cd Physics-Playground
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Run the development server**
    ```bash
    npm run dev
    ```

4.  **Build for production**
    ```bash
    npm run build
    ```

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request for any bugs, feature requests, or physics engine optimizations.

---
*Developed with love for Physics and Code.*
