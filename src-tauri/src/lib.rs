use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, RunEvent, WindowEvent,
};

/// 显示并聚焦主窗口（从托盘 / Dock 唤出）
fn show_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// 真正结束进程。
///
/// 不能用 `app.exit()`：macOS 的退出流程会逐个询问窗口的 `windowShouldClose`，
/// tao 把它转成 `CloseRequested`，被下面「关闭即隐藏」的 prevent_close 挡下，
/// 于是 AppKit 取消退出，表现为 Cmd+Q / 托盘退出都退不掉（实测确认）。
/// 这里绕过窗口关闭流程，先做 Tauri 清理再直接结束进程。
fn force_quit(app: &tauri::AppHandle) {
    app.cleanup_before_exit();
    std::process::exit(0);
}

/// macOS：把系统自动生成的 Quit 菜单项替换成自定义项，让 Cmd+Q 真正退出
/// （原生 Quit 同样会被窗口关闭拦截吞掉）
#[cfg(target_os = "macos")]
fn replace_quit_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
    if let Some(menu) = app.menu() {
        // macOS 默认菜单的第一项是应用菜单，Quit 固定排在最后
        if let Some(app_menu) = menu.items()?.first().and_then(|i| i.as_submenu()) {
            let count = app_menu.items()?.len();
            if count > 0 {
                app_menu.remove_at(count - 1)?;
                let quit = MenuItem::with_id(app, "app_quit", "退出 Seaply", true, Some("Command+Q"))?;
                app_menu.append(&quit)?;
            }
        }
    }
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn replace_quit_menu(_app: &tauri::AppHandle) -> tauri::Result<()> {
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if let Err(e) = replace_quit_menu(app.handle()) {
                eprintln!("[seaply] 替换 Quit 菜单失败，Cmd+Q 可能无法退出: {e}");
            }

            // 托盘菜单：macOS 左右键都会弹出；真正退出走这里，关闭按钮只隐藏
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Seaply 客服工作台")
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" | "app_quit" => force_quit(app),
                    "show" => show_main(app),
                    _ => {}
                });

            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            // 点窗口关闭按钮时不结束进程，只隐藏到托盘常驻
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("启动 Seaply 客户端失败");

    app.run(|handle, event| {
        // macOS：窗口隐藏后点 Dock 图标重新唤出（Reopen 为 macOS 专属事件，其余平台跳过）
        #[cfg(target_os = "macos")]
        if let RunEvent::Reopen { .. } = event {
            show_main(handle);
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (handle, event);
    });
}
