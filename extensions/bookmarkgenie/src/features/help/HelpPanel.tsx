import { getLocale, t } from "../../i18n";

export const HelpPanel = () => {
  const locale = getLocale();

  return (
    <section className="side-card help-card">
      <h2>{t("helpTitle", locale)}</h2>
      <p>{t("helpIntro", locale)}</p>
      <div className="help-section">
        <h3>{t("helpShortcuts", locale)}</h3>
        <p>{t("helpShortcutCommand", locale)}</p>
        <p>{t("helpShortcutUndo", locale)}</p>
      </div>
      <div className="help-section">
        <h3>{t("helpSelection", locale)}</h3>
        <p>{t("helpSelectionText", locale)}</p>
      </div>
      <div className="help-section">
        <h3>{t("helpDeadlinks", locale)}</h3>
        <p>{t("helpDeadlinksText", locale)}</p>
      </div>
      <div className="help-section">
        <h3>{t("helpDelete", locale)}</h3>
        <p>{t("helpDeleteText", locale)}</p>
      </div>
      <div className="help-section">
        <h3>{t("helpBackup", locale)}</h3>
        <p>{t("helpBackupText", locale)}</p>
      </div>
      <p className="muted-text">{t("helpLanguage", locale)}: {locale.toUpperCase()}</p>
    </section>
  );
};
