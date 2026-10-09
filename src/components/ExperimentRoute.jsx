import { Fragment, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isShownSearch } from '../experiments/shownExperiment';

/**
 * Remounts its lab whenever the address changes to an experiment the page is
 * not already showing, so opening a link or preset always starts that exact
 * experiment from its initial conditions. URL updates made by the page itself
 * keep the page mounted.
 */
export default function ExperimentRoute({ children }) {
    const location = useLocation();
    const [current, setCurrent] = useState({ key: location.key, generation: 0 });
    if (location.key !== current.key) {
        const external = !isShownSearch(location.pathname, location.search);
        setCurrent({ key: location.key, generation: current.generation + (external ? 1 : 0) });
    }
    return <Fragment key={current.generation}>{children}</Fragment>;
}
