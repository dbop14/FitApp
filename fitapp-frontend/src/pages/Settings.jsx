import { useContext } from 'react'
import { UserContext } from '../context/UserContext'
import UserCard from '../components/ui/UserCard'
import PageHeader from '../components/ui/PageHeader'
import SettingsRow from '../components/ui/SettingsRow'
import ThemeSelector from '../components/ui/ThemeSelector'
import Icon from '../components/ui/Icon'
import LoadDiagnostics from '../components/LoadDiagnostics'

const DATA_SOURCE_LABELS = {
  fitbit: 'Fitbit',
  'google-fit': 'Google Fit',
  'google-health': 'Google Health',
  whoop: 'WHOOP',
  none: 'Not connected',
}

const Settings = () => {
  const { user, logout } = useContext(UserContext)

  const handleLogout = () => {
    logout()
  }

  return (
    <>
      <PageHeader title="Settings" />

      <div className="page-narrow space-y-6">
        <UserCard name={user?.name} picture={user?.picture} message="Manage your account and preferences" />

        <section aria-labelledby="settings-account">
          <h2 id="settings-account" className="section-title mb-2 px-1">Account</h2>
          <div className="card list-divided overflow-hidden">
            <SettingsRow to="/account-settings" icon="user" title="Account" description="Profile photo and name" />
            <SettingsRow
              to="/data-source-settings"
              icon="link"
              tone="accent"
              title="Data source"
              description={DATA_SOURCE_LABELS[user?.dataSource] || 'Google Fit'}
            />
            <SettingsRow to="/notifications" icon="bell" title="Notifications" description="Push notification preferences" />
          </div>
        </section>

        <section aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className="section-title mb-2 px-1">Appearance</h2>
          <div className="card card-pad">
            <p className="mb-3 text-sm text-ink-muted">
              Choose a theme, or follow your device setting.
            </p>
            <ThemeSelector />
          </div>
        </section>

        <section aria-labelledby="settings-about">
          <h2 id="settings-about" className="section-title mb-2 px-1">About</h2>
          <div className="card list-divided overflow-hidden">
            <SettingsRow to="/privacy-policy" icon="shield" tone="neutral" title="Privacy policy" />
            <SettingsRow to="/terms-of-service" icon="file" tone="neutral" title="Terms of service" />
          </div>
        </section>

        <LoadDiagnostics />

        <button type="button" onClick={handleLogout} className="btn btn-secondary btn-lg w-full text-red-600">
          <Icon name="log-out" className="h-5 w-5" />
          Log out
        </button>
      </div>
    </>
  )
}

export default Settings
