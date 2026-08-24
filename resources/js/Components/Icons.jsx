const base = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};

function Svg({ children, className = 'h-5 w-5' }) {
    return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
            {children}
        </svg>
    );
}

export const HomeIcon = (p) => (
    <Svg {...p}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
        <path d="M9.5 20v-5.5h5V20" />
    </Svg>
);

export const UserIcon = (p) => (
    <Svg {...p}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </Svg>
);

export const GradeIcon = (p) => (
    <Svg {...p}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4" />
    </Svg>
);

export const AttendanceIcon = (p) => (
    <Svg {...p}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </Svg>
);

export const CalendarIcon = (p) => (
    <Svg {...p}>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </Svg>
);

export const ShieldIcon = (p) => (
    <Svg {...p}>
        <path d="M12 3 5 6v6c0 4 3 7.4 7 9 4-1.6 7-5 7-9V6z" />
    </Svg>
);

export const InstructorIcon = (p) => (
    <Svg {...p}>
        <path d="m12 4 9 4.5-9 4.5-9-4.5z" />
        <path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11" />
    </Svg>
);

export const AnalyticsIcon = (p) => (
    <Svg {...p}>
        <path d="M4 19h16" />
        <path d="m5 15 4.5-5 3.5 3 5.5-6.5" />
        <path d="M18.5 6.5H15M18.5 6.5V10" />
    </Svg>
);

export const QualificationIcon = (p) => (
    <Svg {...p}>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 3.5h6v3H9z" />
        <path d="m9.5 13 1.8 1.8L15 11" />
    </Svg>
);

export const ExamIcon = (p) => (
    <Svg {...p}>
        <path d="M7 4h10a2 2 0 0 1 2 2v12l-3-2-2 2-2-2-2 2-2-2-3 2V6a2 2 0 0 1 2-2z" />
        <path d="M9 9h6M9 12.5h4" />
    </Svg>
);

export const SearchIcon = (p) => (
    <Svg {...p}>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.5-4.5" />
    </Svg>
);

export const PlusIcon = (p) => (
    <Svg {...p}>
        <path d="M12 5v14M5 12h14" />
    </Svg>
);

export const PrintIcon = (p) => (
    <Svg {...p}>
        <path d="M7 9V4h10v5" />
        <rect x="4" y="9" width="16" height="7" rx="2" />
        <path d="M7 14h10v6H7z" />
    </Svg>
);

export const LogoutIcon = (p) => (
    <Svg {...p}>
        <path d="M14 6V4.5A1.5 1.5 0 0 0 12.5 3H6a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 6 21h6.5a1.5 1.5 0 0 0 1.5-1.5V18" />
        <path d="M10 12h10M17 9l3 3-3 3" />
    </Svg>
);

export const AlertIcon = (p) => (
    <Svg {...p}>
        <path d="M12 4.5 21 19.5H3z" />
        <path d="M12 10v4M12 16.5h.01" />
    </Svg>
);

export const CheckIcon = (p) => (
    <Svg {...p}>
        <path d="m5 12.5 4.5 4.5L19 7" />
    </Svg>
);

export const ChevronLeft = (p) => (
    <Svg {...p}>
        <path d="m14 6-6 6 6 6" />
    </Svg>
);

export const ChevronRight = (p) => (
    <Svg {...p}>
        <path d="m10 6 6 6-6 6" />
    </Svg>
);
