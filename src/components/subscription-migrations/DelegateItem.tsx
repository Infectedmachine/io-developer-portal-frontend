import React, { Component } from "react";
import { WithNamespaces, withNamespaces } from "react-i18next";

type Delegate = {
  sourceName: string;
  sourceSurname: string;
  sourceId: string;
};

// migration status as it matters for this component
export type MigrationStatus = "done" | "doing" | "todo" | "failed";

const StatusIcon = ({
  status,
  t
}: {
  status: MigrationStatus;
  t: (key: string) => string;
}) => {
  switch (status) {
    case "doing":
      return <>{t("migration_status_doing")}</>;
    case "done":
      return <>{t("migration_status_done")}</>;
    case "failed":
      return <>{t("migration_status_failed")}</>;
    case "todo":
      return <>{t("migration_status_todo")}</>;
    default:
      const _: never = status; // exhaustive check
      return null;
  }
};

type OwnProps = {
  t: (key: string) => string;
  // exdcuted when an item is selected/unselected
  onSelectionChange: (id: Delegate["sourceId"], selected: boolean) => void;
  delegate: Delegate;
  migrationStatus: MigrationStatus;
  selected: boolean;
};

type Props = WithNamespaces & OwnProps;

class DelegateItem extends Component<Props> {
  public render() {
    const {
      t,
      delegate: { sourceName: name, sourceSurname: surname, sourceId: id },
      onSelectionChange,
      migrationStatus,
      selected
    } = this.props;
    const isStatusLoaded = typeof migrationStatus !== "undefined";
    const isSelectable =
      migrationStatus === "todo" || migrationStatus === "failed";

    return (
      <div className="d-flex mt-1" style={{ gap: "10px" }}>
        <div style={{ minWidth: "1em", flex: 1, flexGrow: 0 }}>
          {isSelectable && (
            <input
              name="selected"
              type="checkbox"
              defaultChecked={selected}
              onChange={() => {
                this.setState({ selected: !selected });
                onSelectionChange(id, !selected);
              }}
            />
          )}
        </div>
        <div style={{ minWidth: "15em" }}>
          {name} {surname}
        </div>
        <div style={{ flex: 1 }}>
          {isStatusLoaded && (
            <>
              <span>
                <StatusIcon status={migrationStatus} t={t} />
              </span>
            </>
          )}
        </div>
      </div>
    );
  }
}
export default withNamespaces("subscription_migrations")(DelegateItem);
