import { Component } from 'react';
import styles from './ErrorBoundary.module.css';

/** A lazily loaded page failed to download, e.g. because a new version was deployed meanwhile. */
const isChunkLoadError = (error) =>
    /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i
        .test(String(error?.message ?? error));

/**
 * Catches rendering errors below it and shows a recovery screen instead of a
 * blank page. Users see a plain explanation and ways out; the error details
 * (never a stack trace) appear only in development builds.
 *
 * Props: onHome() navigates to the landing page; resetKey — when it changes
 * (e.g. the route), a previous error is cleared.
 */
export default class ErrorBoundary extends Component {
    state = { error: null, resetKey: this.props.resetKey };

    static getDerivedStateFromError(error) {
        return { error };
    }

    static getDerivedStateFromProps(props, state) {
        // Navigating elsewhere clears the error.
        return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
    }

    componentDidCatch(error, info) {
        if (import.meta.env.DEV) console.error('Page crashed:', error, info.componentStack);
    }

    retry = () => this.setState({ error: null });

    home = () => {
        this.setState({ error: null });
        this.props.onHome?.();
    };

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        const chunk = isChunkLoadError(error);
        return (
            <main className={styles.screen}>
                <div className={styles.card} role="alert" aria-labelledby="error-title">
                    <h1 id="error-title">{chunk ? 'This page could not be loaded' : 'Something went wrong on this page'}</h1>
                    <p>
                        {chunk
                            ? 'Part of the app could not be downloaded. This usually means a new version was just published or the connection dropped. Reloading fixes it.'
                            : 'The page hit an unexpected error and stopped. The other labs are not affected. You can try again, or go back to the home page.'}
                    </p>
                    <div className={styles.actions}>
                        {chunk ? (
                            <button type="button" className={styles.primary} onClick={() => window.location.reload()}>Reload page</button>
                        ) : (
                            <button type="button" className={styles.primary} onClick={this.retry}>Try again</button>
                        )}
                        <button type="button" className={styles.secondary} onClick={this.home}>Back to home</button>
                    </div>
                    {import.meta.env.DEV && (
                        <details className={styles.details}>
                            <summary>Error details (development only)</summary>
                            <pre>{String(error?.message ?? error)}</pre>
                        </details>
                    )}
                </div>
            </main>
        );
    }
}
