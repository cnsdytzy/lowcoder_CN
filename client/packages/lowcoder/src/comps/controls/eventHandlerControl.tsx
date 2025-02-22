import EmptyItem from "components/EmptyItem";
import { CustomListAction, list } from "comps/generators/list";
import { simpleMultiComp } from "comps/generators/multi";
import { trans } from "i18n";
import _ from "lodash";
import { DispatchType } from "lowcoder-core";
import {
  AddEventIcon,
  AddLine,
  controlItem,
  CustomPopover,
  EditPopover,
  EventAction,
  EventContent,
  EventDiv,
  EventTitle,
  InlineEventFormWrapper,
  LinkButton,
  OptionType,
  QueryConfigItemWrapper,
  ValueFromOption,
} from "lowcoder-design";
import { Fragment, ReactNode, useContext, useEffect, useState } from "react";
import { memo } from "util/cacheUtils";
import { EditorContext } from "../editorState";
import { ActionSelectorControl } from "./actionSelector/actionSelectorControl";
import { dropdownControl } from "./dropdownControl";

export interface EventConfigType extends OptionType {
  readonly description: string;
}

export type EventConfigsType = readonly EventConfigType[];

interface SingleEventHandlerProperViewProps {
  onCopy: () => void;
  onDelete: () => void;
  inline?: boolean;
  type?: "query";
  popup: boolean;
  eventConfigs: EventConfigsType;
}

const childrenMap = {
  name: dropdownControl<EventConfigsType>([], ""), // event name
  // FIXME: refactor the parameter config more properly
  handler: ActionSelectorControl,
};

class SingleEventHandlerControl<
  T extends EventConfigsType
> extends simpleMultiComp(childrenMap) {
  // view is function (eventName: ValueFromOption<T>) => void, representing a named event
  getView() {
    const name = this.children.name.getView();
    const handler = this.children.handler.getView();
    return (eventName: ValueFromOption<T>) => {
      if (eventName !== name) {
        return;
      }
      if (handler) {
        return handler();
      }
    };
  }

  propertyView(props: SingleEventHandlerProperViewProps) {
    const name = this.children.name.getView();
    const children = this.children;
    const { eventConfigs } = props;

    const eventName = eventConfigs
      .find((x) => x.value === name)
      ?.label?.toString();

    let content: ReactNode = null;
    if (props.inline && eventConfigs.length === 1) {
      content = (
        <InlineEventFormWrapper>
          <div>
            {trans("eventHandler.inlineEventTitle", {
              eventName: eventName?.toLowerCase() ?? "",
            })}
          </div>
          {children.handler.propertyView({
            label: trans("eventHandler.action"),
            placement: props.type,
          })}
        </InlineEventFormWrapper>
      );
    } else {
      content = (
        <>
          {eventConfigs.length > 1 &&
            children.name.propertyView({
              label: trans("eventHandler.event"),
              options: eventConfigs,
            })}
          {children.handler.propertyView({
            label: trans("eventHandler.action"),
            placement: props.type,
          })}
        </>
      );
    }

    const eventAction = this.children.handler.displayName();

    if (props.inline) {
      return content;
    }
    return (
      <EventDiv>
        <CustomPopover
          title={trans("edit")}
          content={content}
          type={props.type}
          defaultVisible={props.popup}
        >
          <EventContent>
            {!_.isEmpty(eventName) && <EventTitle>{eventName}</EventTitle>}
            <EventAction>{eventAction}</EventAction>
          </EventContent>
        </CustomPopover>
        <EditPopover copy={props.onCopy} del={props.onDelete} />
      </EventDiv>
    );
  }
}

const EventHandlerControlPropertyView = (props: {
  dispatch: DispatchType;
  pushAction: (
    value: any
  ) => CustomListAction<typeof SingleEventHandlerControl>;
  deleteAction: (
    index: number
  ) => CustomListAction<typeof SingleEventHandlerControl>;
  items: InstanceType<typeof SingleEventHandlerControl>[];
  inline?: boolean;
  title?: ReactNode;
  type?: "query";
  eventConfigs: EventConfigsType;
}) => {
  const {
    dispatch,
    pushAction,
    deleteAction,
    inline = false,
    items,
    eventConfigs,
    type,
  } = props;
  const editorState = useContext(EditorContext);
  const [showNewCreate, setShowNewCreate] = useState(false);

  useEffect(() => setShowNewCreate(false), [dispatch]);

  const queryHandler = {
    name: eventConfigs[0].value,
  };

  const handleAdd = () => {
    if (eventConfigs.length === 0) {
      return;
    }
    const queryExecHandler = {
      compType: "message",
      comp: {
      },
    };
    const messageHandler = {
      compType: "message",
    };
    const isInDevIde = !!window.__LOWCODER_ORG__;
    const newHandler = {
      name: eventConfigs[0].value,
      handler: isInDevIde ? messageHandler : queryExecHandler,
    } as const;
    dispatch(pushAction(type !== "query" ? newHandler : queryHandler));
    setShowNewCreate(true);
  };

  const renderItems = () =>
    items.length > 0 ? (
      <div>
        {items.map((child, index) => (
          <Fragment key={index}>
            {child.propertyView({
              type,
              inline,
              onCopy: () => dispatch(pushAction({ ...child.toJsonValue() })),
              onDelete: () => dispatch(deleteAction(index)),
              popup: showNewCreate && index === items.length - 1,
              eventConfigs,
            })}
          </Fragment>
        ))}
      </div>
    ) : (
      <EmptyItem onClick={handleAdd}>
        {trans("eventHandler.emptyEventHandlers")}
      </EmptyItem>
    );
  if (props.inline) {
    return <div style={{ paddingTop: 8 }}>{renderItems()}</div>;
  }
  if (type === "query") {
    return (
      <QueryConfigItemWrapper>
        <LinkButton
          text={trans("addItem")}
          icon={<AddEventIcon />}
          onClick={() => {
            dispatch(pushAction(queryHandler));
            setShowNewCreate(true);
          }}
        />
        <div style={{ height: "8px" }} />
        {renderItems()}
      </QueryConfigItemWrapper>
    );
  }
  return (
    <>
      <AddLine title={props.title} add={handleAdd} />
      {renderItems()}
    </>
  );
};

class EventHandlerControl<T extends EventConfigsType> extends list(
  SingleEventHandlerControl
) {
  @memo
  // @ts-ignore
  getView() {
    return (eventName: ValueFromOption<T>) => {
      const list: Promise<unknown>[] = [];
      super.getView().forEach((child) => {
        const ret = child.getView()(eventName);
        if (ret) {
          list.push(ret);
        }
      });
      return Promise.all(list);
    };
  }

  isBind(eventName: ValueFromOption<T>) {
    return super
      .getView()
      .some((child) => child.children.name.getView() === eventName);
  }

  override getPropertyView() {
    return this.propertyView();
  }

  propertyView(options?: {
    inline?: boolean;
    title?: ReactNode;
    type?: "query";
    eventConfigs: T;
  }) {
    const title = options?.title ?? trans("eventHandler.eventHandlers");
    return controlItem(
      { filterText: title },
      <EventHandlerControlPropertyView
        type={options?.type}
        eventConfigs={options?.eventConfigs || []}
        dispatch={this.dispatch}
        pushAction={this.pushAction}
        deleteAction={this.deleteAction}
        items={super.getView() as any}
        inline={options?.inline}
        title={title}
      />
    );
  }
}

export function eventHandlerControl<T extends EventConfigsType>(
  eventConfigs?: T,
  type?: "query"
) {
  class EventHandlerTempControl extends EventHandlerControl<T> {
    getEventNames() {
      return eventConfigs;
    }

    propertyView(options?: {
      inline?: boolean;
      title?: ReactNode;
      eventConfigs?: T;
    }) {
      return super.propertyView({
        ...options,
        type,
        eventConfigs: options?.eventConfigs || eventConfigs || ([] as any),
      });
    }
  }

  return EventHandlerTempControl;
}

export const submitEvent: EventConfigType = {
  label: trans("event.submit"),
  value: "submit",
  description: trans("event.submitDesc"),
};
export const changeEvent: EventConfigType = {
  label: trans("event.change"),
  value: "change",
  description: trans("event.changeDesc"),
};
export const focusEvent: EventConfigType = {
  label: trans("event.focus"),
  value: "focus",
  description: trans("event.focusDesc"),
};
export const blurEvent: EventConfigType = {
  label: trans("event.blur"),
  value: "blur",
  description: trans("event.blurDesc"),
};
export const clickEvent: EventConfigType = {
  label: trans("event.click"),
  value: "click",
  description: trans("event.clickDesc"),
};
export const closeEvent: EventConfigType = {
  label: trans("event.close"),
  value: "close",
  description: trans("event.closeDesc"),
};
export const successEvent: EventConfigType = {
  label: trans("event.success"),
  value: "success",
  description: trans("event.successDesc"),
};
export const deleteEvent: EventConfigType = {
  label: trans("event.delete"),
  value: "delete",
  description: trans("event.deleteDesc"),
};
export const mentionEvent: EventConfigType = {
  label: trans("event.mention"),
  value: "mention",
  description: trans("event.mentionDesc"),
};
export const audioUnmuted: EventConfigType = {
  label: trans("meeting.audioUnmuted"),
  value: "audioUnmuted",
  description: trans("meeting.audioUnmuted"),
};
export const audioMuted: EventConfigType = {
  label: trans("meeting.audioMuted"),
  value: "audioMuted",
  description: trans("meeting.audioMuted"),
};
export const videoOff: EventConfigType = {
  label: trans("meeting.videoOff"),
  value: "videoOff",
  description: trans("meeting.videoOff"),
};
export const videoOn: EventConfigType = {
  label: trans("meeting.videoOn"),
  value: "videoOn",
  description: trans("meeting.videoOn"),
};
export const videoClicked: EventConfigType = {
  label: trans("meeting.videoClicked"),
  value: "videoClicked",
  description: trans("meeting.videoClicked"),
};
export const addedMarkerEvent: EventConfigType = {
  label: trans("event.addedMarker"),
  value: "addedMarker",
  description: trans("event.addedMarkerDesc"),
};
export const addedLinkEvent: EventConfigType = {
  label: trans("event.addedLink"),
  value: "addedLink",
  description: trans("event.addedLinkDesc"),
};
export const addTaskEvent: EventConfigType = {
  label: trans("event.addTask"),
  value: "addTask",
  description: trans("event.addTaskDesc"),
};
export const deletedLinkEvent: EventConfigType = {
  label: trans("event.deletedLink"),
  value: "deletedLink",
  description: trans("event.deletedLinkDesc"),
};
export const ProgressDragEvent: EventConfigType = {
  label: trans("event.progressDrag"),
  value: "progressDrag",
  description: trans("event.progressDragDesc"),
};
export const TaskChangeEvent: EventConfigType = {
  label: trans("event.TaskChange"),
  value: "TaskChange",
  description: trans("event.TaskChangeDesc"),
};
export const delteMarkerEvent: EventConfigType = {
  label: trans("event.delteMarker"),
  value: "delteMarker",
  description: trans("event.delteMarkerDesc"),
};
export const clickMarkerEvent: EventConfigType = {
  label: trans("event.clickMarker"),
  value: "clickMarker",
  description: trans("event.delteMarkerDesc"),
};
export const amapMoveEndEvent: EventConfigType = {
  label: trans("event.amapMoveEnd"),
  value: "amapMoveEnd",
  description: trans("event.amapMoveEndDesc"),
};
export const clickLogoEvent: EventConfigType = {
  label: trans("event.clickLogoEvent"),
  value: "clickLogo",
  description: trans("event.clickLogoEventDesc"),
};
export const clickMenuEvent: EventConfigType = {
  label: trans("event.clickMenuEvent"),
  value: "clickMenu",
  description: trans("event.clickMenuEventDesc"),
};
export const refreshEvent: EventConfigType = {
  label: trans("event.refresh"),
  value: "refresh",
  description: trans("event.refreshDesc"),
};
export const dbClickEvent: EventConfigType = {
  label: trans("event.dbClick"),
  value: "dbClick",
  description: trans("event.dbClickDesc"),
};
export const expanderClickEvent: EventConfigType = {
  label: trans("event.expanderClick"),
  value: "expanderClick",
  description: trans("event.expanderClickDesc"),
};
export const searchEvent: EventConfigType = {
  label: trans("event.search"),
  value: "search",
  description: trans("event.searchDesc"),
};
export const selectedChangeEvent: EventConfigType = {
  label: trans("event.selectedChange"),
  value: "selectedChange",
  description: trans("event.selectedChangeDesc"),
};
export const clickExtraEvent: EventConfigType = {
  label: trans("event.clickExtra"),
  value: "clickExtra",
  description: trans("event.clickExtraDesc"),
};
export const InputEventHandlerControl = eventHandlerControl([
  changeEvent,
  focusEvent,
  blurEvent,
  submitEvent,
] as const);

export const ButtonEventHandlerControl = eventHandlerControl([
  clickEvent,
] as const);

export const ChangeEventHandlerControl = eventHandlerControl([
  changeEvent,
] as const);

export const SelectEventHandlerControl = eventHandlerControl([
  changeEvent,
  focusEvent,
  blurEvent,
] as const);

export const ScannerEventHandlerControl = eventHandlerControl([
  clickEvent,
  successEvent,
  closeEvent,
] as const);

export const MeetingEventHandlerControl = eventHandlerControl([
  audioMuted,
  audioUnmuted,
  videoOff,
  videoOn,
  videoClicked,
] as const);

export const CardEventHandlerControl = eventHandlerControl([
  clickEvent,
  clickExtraEvent,
  focusEvent,
  blurEvent,
] as const);
