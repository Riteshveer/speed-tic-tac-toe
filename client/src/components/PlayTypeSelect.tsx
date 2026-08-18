interface PlayTypeSelectProps {
  onSelectPlayOnline: () => void;
  onSelectPlayWithFriends?: () => void;
}

export default function PlayTypeSelect({
  onSelectPlayOnline,
  onSelectPlayWithFriends,
}: PlayTypeSelectProps) {
  const handlePlayWithFriends = () => {
    if (onSelectPlayWithFriends) {
      onSelectPlayWithFriends();
    } else {
      // TODO: implement private room/invite flow
      console.log("Play with Friends selected — TODO: implement private room flow");
      alert("Play with Friends coming soon!");
    }
  };

  return (
    <div className="play-type-container fade-in">
      <div className="play-type-hero">
        <h1 className="play-type-title">SpeedTTT</h1>
        <p className="play-type-subtitle">Choose how you want to play</p>
      </div>

      <div className="play-type-cards">
        {/* Play Online Card */}
        <button
          id="btn-play-online"
          className="play-type-card online-card"
          onClick={onSelectPlayOnline}
        >
          <div className="play-type-icon">🌐</div>
          <h2 className="play-type-card-title">Play Online</h2>
          <p className="play-type-card-desc">Match with players online</p>
        </button>

        {/* Play with Friends Card */}
        <button
          id="btn-play-friends"
          className="play-type-card friends-card"
          onClick={handlePlayWithFriends}
        >
          <div className="play-type-icon">👥</div>
          <h2 className="play-type-card-title">Play with Friends</h2>
          <p className="play-type-card-desc">Create a private game with friends</p>
        </button>
      </div>
    </div>
  );
}
