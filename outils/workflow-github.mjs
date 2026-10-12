const ENTETE_DE_JOB = /^ {2}([\w-]+):\s*$/;

/**
 * @param {string} texteWorkflow
 * @returns {Record<string, string>}
 */
export function blocsDesJobs(texteWorkflow) {
  const lignes = texteWorkflow.split('\n');
  const debutJobs = lignes.findIndex((ligne) => /^jobs:\s*$/.test(ligne));
  if (debutJobs < 0) {
    throw new Error('workflow : aucune section jobs: - aucun job ne peut y etre verifie.');
  }
  /** @type {Record<string, string>} */
  const blocs = {};
  let jobCourant = null;
  let depart = -1;
  for (let i = debutJobs + 1; i <= lignes.length; i += 1) {
    const entete = ENTETE_DE_JOB.exec(lignes[i] ?? '');
    if (!entete && i < lignes.length) continue;
    if (jobCourant !== null) blocs[jobCourant] = lignes.slice(depart, i).join('\n');
    if (entete) {
      jobCourant = entete[1];
      depart = i;
    }
  }
  return blocs;
}

/**
 * @param {string} texteWorkflow
 * @param {string} job
 * @returns {{ nom: string, commande: string }[]}
 */
export function etapesDuJob(texteWorkflow, job) {
  if (texteWorkflow.trim() === '') {
    throw new Error('workflow : le texte est vide - aucune porte ne peut y etre verifiee.');
  }
  const bloc = blocsDesJobs(texteWorkflow)[job];
  if (bloc === undefined) {
    throw new Error(`workflow : le job « ${job} » est introuvable.`);
  }
  /** @type {{ nom: string, commande: string }[]} */
  const etapes = [];
  let nomCourant = null;
  for (const ligne of bloc.split('\n')) {
    const nomTrouve = /^\s*-\s*name:(.*)$/.exec(ligne);
    if (nomTrouve) {
      nomCourant = nomTrouve[1].trim();
      continue;
    }
    const commandeTrouvee = /^\s*run:(.*)$/.exec(ligne);
    if (commandeTrouvee && nomCourant) {
      etapes.push({ nom: nomCourant, commande: commandeTrouvee[1].trim() });
      nomCourant = null;
    }
  }
  if (etapes.length === 0) {
    throw new Error(
      `workflow : le job « ${job} » ne declare aucune etape « run: » - impossible d'y verifier une porte.`,
    );
  }
  return etapes;
}
