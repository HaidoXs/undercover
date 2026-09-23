import { Info, ListChecks, ShieldAlert, Target, Trophy, Zap } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { specialRole, type SpecialRoleId } from '../../../shared/specialRoles';
import { cls } from '../lib/util';
import { SPECIAL_ICON } from './icons';
import { Sheet } from './Sheet';

/**
 * Une seule fiche de rôle, montée au niveau de l'application : elle reste ouverte même si le bouton
 * qui l'a ouverte disparaît (carte privée remasquée, changement de phase). Elle ne touche ni au chrono
 * ni aux saisies en cours.
 */
let openRole: SpecialRoleId | null = null;
const listeners = new Set<() => void>();

function setOpenRole(role: SpecialRoleId | null): void {
  openRole = role;
  for (const l of listeners) l();
}

function useOpenRole(): SpecialRoleId | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => openRole,
  );
}

export function RoleInfoButton({ roleId, className }: { roleId: SpecialRoleId; className?: string }) {
  const def = specialRole(roleId);
  return (
    <button
      type="button"
      className={cls('info-btn', className)}
      onClick={(e) => {
        e.stopPropagation();
        setOpenRole(roleId);
      }}
      aria-label={`Fiche du rôle ${def.name}`}
      title={`Fiche du rôle ${def.name}`}
    >
      <Info size={16} strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}

export function RoleSheetHost() {
  const roleId = useOpenRole();
  const def = roleId ? specialRole(roleId) : null;
  const Icon = roleId ? SPECIAL_ICON[roleId] : Info;
  return (
    <Sheet open={roleId !== null} onClose={() => setOpenRole(null)} title={def?.name ?? 'Rôle'} icon={<Icon size={20} />}>
      {def && (
        <div className="role-sheet">
          <p className="role-sheet-tagline">{def.tagline}</p>
          <section>
            <h3>
              <Zap size={17} aria-hidden="true" /> Pouvoir
            </h3>
            <p>{def.power}</p>
          </section>
          <section>
            <h3>
              <Target size={17} aria-hidden="true" /> Objectif
            </h3>
            <p>{def.objective}</p>
          </section>
          <section>
            <h3>
              <Trophy size={17} aria-hidden="true" /> Condition de victoire
            </h3>
            <p>{def.victory}</p>
          </section>
          <section>
            <h3>
              <ShieldAlert size={17} aria-hidden="true" /> Restrictions
            </h3>
            <ul>
              {def.restrictions.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Sheet>
  );
}

/** Liste des rôles activés, sans jamais dire qui les porte. */
export function RolesOverview({ roles, title = 'Rôles spéciaux de cette partie' }: { roles: readonly SpecialRoleId[]; title?: string }) {
  if (roles.length === 0) return null;
  return (
    <section className="help-section">
      <h3>
        <ListChecks size={18} /> {title}
      </h3>
      <p>Chaque joueur en porte au plus un, en plus de son camp. Qui les porte reste secret (sauf la Justice).</p>
      <ul className="roles-overview">
        {roles.map((id) => {
          const def = specialRole(id);
          const Icon = SPECIAL_ICON[id];
          return (
            <li key={id}>
              <span className="role-dot" aria-hidden="true">
                <Icon size={17} />
              </span>
              <span className="grow">
                <strong>{def.name}</strong>
                <span className="subtle">{def.tagline}</span>
              </span>
              <RoleInfoButton roleId={id} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
