import { useEffect, useState } from "react";
import { identity } from "../../services/api/identity";

/** School registration remains the safe fallback when the policy cannot load. */
export function useRegistrationOptions() {
  const [options, setOptions] = useState({ personalLearnerEnabled: false, loading: true });
  useEffect(() => {
    let active = true;
    identity.registrationOptions().then(
      result => { if (active) setOptions({ personalLearnerEnabled: result.roles.includes("personal_student"), loading: false }); },
      () => { if (active) setOptions({ personalLearnerEnabled: false, loading: false }); },
    );
    return () => { active = false; };
  }, []);
  return options;
}
