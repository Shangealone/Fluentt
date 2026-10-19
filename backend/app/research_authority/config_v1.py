"""Frozen D11A documents. No executable scheduler logic."""

CONFIGURATIONS = (
    {
        "config_version": "sm2-binary-config-v1",
        "scheduler_type": "conventional_srs",
        "algorithm_version": "sm2-binary-v1",
        "state_schema_version": 1,
        "canonical_document": '{"algorithm_version":"sm2-binary-v1","binary_rating":{"correct":4,"incorrect":2},"config_version":"sm2-binary-config-v1","correct_transition":{"first_intervals_days":[1,6],"lapse_increment":0,"later_interval":"ceil(previous_interval_days*updated_ease_factor)","repetition_increment":1},"day_seconds":86400,"ease_update":{"apply_to":"every_response","arithmetic":"exact_decimal","formula":"EF+0.1-(5-q)*(0.08+(5-q)*0.02)","minimum":"1.3"},"incorrect_transition":{"interval_days":1,"lapse_increment":1,"repetition_reset":0},"initial_memory":{"ease_factor":"2.5","interval_days":0,"lapse_count":0,"repetition_count":0},"interval_cap":"after_transition","maximum_interval_days":36500,"minimum_interval_days":1,"same_session_remedial_repetition":false,"scheduler_type":"conventional_srs","state_schema_version":1}',
        "config_sha256": "3bd486d1183d84a869a2470f0a97a13ecabc44365eb9fe8e158014fd1ef2a0d9",
    },
    {
        "config_version": "fsrs6-binary-r90-config-v1",
        "scheduler_type": "enhanced_srs",
        "algorithm_version": "fluentt-esr-fsrs6-binary-v1",
        "state_schema_version": 1,
        "canonical_document": '{"algorithm_version":"fluentt-esr-fsrs6-binary-v1","binary_rating":{"correct":3,"incorrect":1},"config_version":"fsrs6-binary-r90-config-v1","day_seconds":86400,"desired_retention":"0.90","elapsed_days":"pinned_engine_timedelta_days","enable_fuzzing":false,"engine":{"distribution":"fsrs","model":"FSRS-6","version":"6.3.2"},"interval_rounding":"pinned_engine_round_then_clamp","learning_steps_seconds":[],"maximum_interval_days":36500,"minimum_interval_days":1,"numeric_arithmetic":"pinned_engine_binary64","optimizer_enabled":false,"parameters":["0.212","1.2931","2.3065","8.2956","6.4133","0.8334","3.0194","0.001","1.8722","0.1666","0.796","1.4835","0.0614","0.2629","1.6483","0.6014","1.8729","0.5425","0.0912","0.0658","0.1542"],"participant_time_global_retraining":false,"relearning_steps_seconds":[],"same_session_remedial_repetition":false,"scheduler_type":"enhanced_srs","state_schema_version":1}',
        "config_sha256": "4e4c56a9f928cae5581e5d577de413b17c9d581185482db423a98551f6575e4f",
    },
)
