import { BookOpen, CircleHelp, Ghost, MessageSquareQuote, Scale, Trophy, Users, VenetianMask, Vote } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from './Sheet';

export function HelpContent() {
  return (
    <div>
      <section className="help-section">
        <h3>
          <BookOpen size={18} /> Le principe
        </h3>
        <p>
          Chaque joueur reçoit une carte secrète. Presque tout le monde a le même mot… sauf les intrus. À coups d’indices et de
          votes, démasquez-les avant qu’ils ne prennent le contrôle.
        </p>
      </section>

      <section className="help-section">
        <h3>
          <Users size={18} /> Les rôles
        </h3>
        <div className="help-roles">
          <div className="help-role role-civil">
            <Users size={20} />
            <p>
              <strong>Civils</strong> — ils partagent tous le même mot. Majoritaires au départ.
            </p>
          </div>
          <div className="help-role role-undercover">
            <VenetianMask size={20} />
            <p>
              <strong>Undercover</strong> — ils ont un mot proche, mais différent. Personne ne connaît son rôle : un Undercover
              peut se croire Civil !
            </p>
          </div>
          <div className="help-role role-mrwhite">
            <Ghost size={20} />
            <p>
              <strong>Mr. White</strong> — optionnel dès 5 joueurs. Il n’a aucun mot et le sait : il doit bluffer.
            </p>
          </div>
        </div>
      </section>

      <section className="help-section">
        <h3>
          <MessageSquareQuote size={18} /> Les indices
        </h3>
        <ul>
          <li>Chacun son tour, dans l’ordre fixé par le serveur, donne un indice court.</li>
          <li>Interdit de dire son mot. Si le temps s’écoule, le tour est « Passé ».</li>
          <li>Mr. White ne commence jamais le premier tour.</li>
        </ul>
      </section>

      <section className="help-section">
        <h3>
          <Vote size={18} /> Le vote
        </h3>
        <ul>
          <li>Chaque joueur en jeu vote secrètement contre un autre. Un seul vote, définitif.</li>
          <li>On voit qui a voté, mais les choix restent cachés jusqu’à la clôture.</li>
          <li>Sans vote à temps : abstention. Le plus désigné est éliminé et son rôle révélé (jamais son mot).</li>
        </ul>
      </section>

      <section className="help-section">
        <h3>
          <Scale size={18} /> Égalité
        </h3>
        <p>
          Égalité en tête : second scrutin limité aux ex æquo, avec tous les joueurs en jeu comme votants. Si l’égalité persiste
          ou si personne n’a voté, personne n’est éliminé et un nouveau tour d’indices commence.
        </p>
      </section>

      <section className="help-section">
        <h3>
          <Trophy size={18} /> La victoire
        </h3>
        <ul>
          <li>Mr. White éliminé a une dernière chance : s’il devine le mot des Civils, il gagne immédiatement.</li>
          <li>Les Civils gagnent quand il ne reste plus aucun intrus.</li>
          <li>Les intrus encore en jeu gagnent dès qu’ils sont aussi nombreux que les Civils restants.</li>
        </ul>
      </section>
    </div>
  );
}

export function HelpButton({ label = 'Aide' }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label={label} title="Règles du jeu">
        <CircleHelp size={20} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Comment jouer" icon={<CircleHelp size={20} />}>
        <HelpContent />
      </Sheet>
    </>
  );
}
