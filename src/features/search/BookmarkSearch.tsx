type BookmarkSearchProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

export const BookmarkSearch = ({ value, onChange, autoFocus }: BookmarkSearchProps) => (
  <label className="search-box">
    <span>Search</span>
    <input
      autoFocus={autoFocus}
      value={value}
      placeholder="Search... try tag:vpn site:cisco.com folder:wireless is:dead title:vpn"
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);
