import { useEffect, useState } from "react";
import { identity } from "../../services/api/identity";

/** This client offers school signup only; existing personal accounts still sign in. */
export function useRegistrationOptions() {
  const [options, setOptions] = useState({ personalLearnerEnabled: false, loading: true });
  useEffect(() => {
    let active = true;
    identity.registrationOptions().then(
      () => { if (active) setOptions({ personalLearnerEnabled: false, loading: false }); },
      () => { if (active) setOptions({ personalLearnerEnabled: false, loading: false }); },
    );
    return () => { active = false; };
  }, []);
  return options;
}
